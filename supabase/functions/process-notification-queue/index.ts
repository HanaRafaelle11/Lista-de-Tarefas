import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getExponentialBackoffTime(attempts: number): string {
  const minutes = attempts === 1 ? 5 : attempts === 2 ? 15 : attempts === 3 ? 30 : 60;
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

serve(async (req) => {
  const startTime = Date.now();
  const workerId = `worker_delegate_${startTime}_${Math.random().toString(36).substring(2, 7)}`;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE environment keys' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        status: 500
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending or failed retryable notifications
    const { data: queue, error: queueError } = await supabase
      .from('notification_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('scheduled_for', new Date().toISOString())
      .lt('attempts', 5)
      .order('priority', { ascending: false })
      .order('scheduled_for', { ascending: true })
      .limit(100);

    if (queueError) {
      return new Response(JSON.stringify({ error: queueError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    if (!queue?.length) {
      return new Response(JSON.stringify({ message: 'No pending notifications', processed: 0, workerId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    let processedCount = 0;

    for (const item of queue) {
      try {
        // Trava de Idempotência
        const { error: lockErr } = await supabase
          .from('notification_queue')
          .update({ status: 'processing', attempts: (item.attempts || 0) + 1 })
          .eq('id', item.id);
        
        if (lockErr) throw lockErr;

        const rawBody = item.body || '';
        const cleanBodyText = rawBody.split('--flowday-meta--')[0].trim();
        const finalBody = cleanBodyText || `Sua tarefa "${item.title}" vence agora no MyFlowDay.`;

        const { error: insertErr } = await supabase.from('in_app_notifications').insert({
          user_id: item.user_id,
          notification_queue_id: item.id,
          event_type: item.event_type || 'TASK_DUE',
          entity_type: item.entity_type || 'task',
          entity_id: item.entity_id || item.task_id || '',
          title: item.title,
          body: finalBody
        });

        if (insertErr) throw insertErr;

        // Invoca a única Edge Function 'push'
        const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke('push', {
          body: {
            type: 'send',
            payload: {
              user_id: item.user_id,
              title: item.title,
              body: finalBody,
              url: item.entity_type === 'focus' ? '/focus' : item.entity_type === 'goal' ? '/goals' : '/tasks',
              entity_id: item.entity_id || item.task_id || '',
              entity_type: item.entity_type || 'task'
            }
          }
        });

        if (invokeErr) throw invokeErr;
        if (invokeRes?.error) throw new Error(invokeRes.error);

        // Sucesso
        const { error: successErr } = await supabase
          .from('notification_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', item.id);

        if (successErr) throw successErr;

        const { error: analyticsErr } = await supabase.from('notification_analytics').insert({
          user_id: item.user_id,
          notification_id: item.id,
          event: 'sent',
          metadata: invokeRes
        });

        if (analyticsErr) throw analyticsErr;

        const { error: logsErr } = await supabase.from('notification_logs').insert({
          user_id: item.user_id,
          notification_queue_id: item.id,
          status: 'sent',
          title: item.title,
          body: finalBody,
          payload: invokeRes
        });

        if (logsErr) throw logsErr;

        processedCount++;

      } catch (err) {
        const errMsg = String(err.message || err);
        const nextRetry = getExponentialBackoffTime((item.attempts || 0) + 1);

        console.error(`[Worker Error] Failed to process notification ${item.id}: ${errMsg}`);

        // Tenta marcar como falho na fila (sem updated_at)
        await supabase
          .from('notification_queue')
          .update({ status: 'failed', scheduled_for: nextRetry, last_error: errMsg })
          .eq('id', item.id);

        await supabase.from('notification_analytics').insert({
          user_id: item.user_id,
          notification_id: item.id,
          event: 'failed',
          metadata: { error: errMsg }
        });

        await supabase.from('notification_logs').insert({
          user_id: item.user_id,
          notification_queue_id: item.id,
          status: 'failed',
          title: item.title,
          body: item.body,
          error_message: errMsg
        });
      }
    }

    return new Response(JSON.stringify({ message: 'E2E Worker execution completed via delegate', processed: processedCount, workerId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      status: 200
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err), workerId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      status: 500
    });
  }
});

