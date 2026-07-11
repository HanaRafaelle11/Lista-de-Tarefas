import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { handleTaskCreated } from './handlers/task-created.ts';
import { handleTaskUpdated } from './handlers/task-updated.ts';
import { handleTaskCompleted } from './handlers/task-completed.ts';
import { handleTaskDeleted } from './handlers/task-deleted.ts';
import { handleHabitCompleted } from './handlers/habit-completed.ts';
import { handleGoalCompleted } from './handlers/goal-completed.ts';
import { handleAnalyticsEvent } from './handlers/analytics-handler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Algoritmo de Retry Exponencial (1 min, 5 min, 15 min, 1 hora)
function getExponentialBackoffDelay(retryCount: number): number {
  switch (retryCount) {
    case 1: return 60 * 1000;         // 1 min
    case 2: return 5 * 60 * 1000;     // 5 min
    case 3: return 15 * 60 * 1000;    // 15 min
    default: return 60 * 60 * 1000;   // 1 hora
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE environment keys' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Selecionar eventos pendentes ou que falharam mas estão elegíveis para retry
    const { data: pendingEvents, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lt('retry_count', 4)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    if (!pendingEvents?.length) {
      return new Response(JSON.stringify({ message: 'No pending events', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    let processedCount = 0;

    for (const event of pendingEvents) {
      const startTime = Date.now();

      // Trava de idempotência atômica optimista
      const { error: lockError } = await supabase
        .from('events')
        .update({ status: 'processing', retry_count: event.retry_count + 1 })
        .eq('id', event.id)
        .eq('status', event.status);

      if (lockError) continue;

      // Normalize event payload: client-logged events have data in event.metadata
      if (!event.payload && event.metadata) {
        event.payload = event.metadata;
      }

      let normalizedType = event.event_type;
      const typeMappings: Record<string, string> = {
        'task_created': 'TaskCreated',
        'task_completed': 'TaskCompleted',
        'task_updated': 'TaskUpdated',
        'task_deleted': 'TaskDeleted',
        'goal_completed': 'GoalCompleted',
        'habit_completed': 'HabitCompleted'
      };
      if (normalizedType && typeMappings[normalizedType]) {
        normalizedType = typeMappings[normalizedType];
      }

      let handlerName = 'unknown';
      let handlerResult = null;
      let handlerError = null;

      try {
        switch (normalizedType) {
          case 'TaskCreated':
            handlerName = 'task-created';
            handlerResult = await handleTaskCreated(supabase, event);
            break;
          case 'TaskUpdated':
            handlerName = 'task-updated';
            handlerResult = await handleTaskUpdated(supabase, event);
            break;
          case 'TaskCompleted':
            handlerName = 'task-completed';
            handlerResult = await handleTaskCompleted(supabase, event);
            break;
          case 'TaskDeleted':
            handlerName = 'task-deleted';
            handlerResult = await handleTaskDeleted(supabase, event);
            break;
          case 'HabitCompleted':
            handlerName = 'habit-completed';
            handlerResult = await handleHabitCompleted(supabase, event);
            break;
          case 'GoalCompleted':
            handlerName = 'goal-completed';
            handlerResult = await handleGoalCompleted(supabase, event);
            break;
          default:
            handlerName = 'analytics-fallback';
            handlerResult = await handleAnalyticsEvent(supabase, event);
            break;
        }

        // Também executa analytics passivo em background
        await handleAnalyticsEvent(supabase, event);

        // Sucesso do Handler
        const executionTime = Date.now() - startTime;
        await supabase
          .from('events')
          .update({ status: 'processed', processed_at: new Date().toISOString(), last_error: null })
          .eq('id', event.id);

        await supabase.from('event_logs').insert({
          event_id: event.id,
          handler: handlerName,
          started_at: new Date(startTime).toISOString(),
          finished_at: new Date().toISOString(),
          status: 'success',
          execution_time: executionTime,
          error: null
        });

        processedCount++;
      } catch (err) {
        handlerError = String(err.message || err);
        const executionTime = Date.now() - startTime;
        const currentRetries = event.retry_count + 1;

        // Registrar log de falha
        await supabase.from('event_logs').insert({
          event_id: event.id,
          handler: handlerName,
          started_at: new Date(startTime).toISOString(),
          finished_at: new Date().toISOString(),
          status: 'failed',
          execution_time: executionTime,
          error: handlerError
        });

        if (currentRetries >= 4) {
          // Limite de retries excedido -> Redirecionar para Dead Letter Queue
          await supabase
            .from('events')
            .update({ status: 'failed', last_error: `DEAD_LETTER: ${handlerError}` })
            .eq('id', event.id);

          await supabase.from('dead_letter_events').insert({
            event_id: event.id,
            aggregate_type: event.aggregate_type,
            event_type: event.event_type,
            user_id: event.user_id,
            payload: event.payload,
            handler: handlerName,
            error: handlerError,
            tentativas: currentRetries
          });
        } else {
          // Atualiza status para retry futuro
          await supabase
            .from('events')
            .update({ status: 'failed', last_error: handlerError })
            .eq('id', event.id);
        }
      }
    }

    return new Response(JSON.stringify({ message: 'Events processed successfully', processed: processedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
