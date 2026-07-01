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

/**
 * Strips the internal --flowday-meta-- block from notification body text.
 * Returns a clean, user-friendly string.
 */
function cleanBody(raw: string | null | undefined, title: string): string {
  if (!raw) return `Sua tarefa "${title}" vence agora no MyFlowDay.`;
  // Remove everything from --flowday-meta-- onward (including the marker itself)
  let cleaned = raw.split('--flowday-meta--')[0].trim();
  // Remove any stray JSON blocks that might remain
  cleaned = cleaned.replace(/\{[\s\S]*?"due_time"[\s\S]*?\}/g, '').trim();
  // Remove trailing newlines and whitespace
  cleaned = cleaned.replace(/[\n\r]+$/g, '').trim();
  if (!cleaned) return `Sua tarefa "${title}" vence agora no MyFlowDay.`;
  return cleaned;
}

serve(async (req) => {
  const startTime = Date.now();
  const workerId = `worker_${startTime}_${Math.random().toString(36).substring(2, 7)}`;

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

    // Fetch pending or failed retryable notifications whose scheduled_for <= now
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
      // 1. Lock: mark as processing
      const { error: lockErr } = await supabase
        .from('notification_queue')
        .update({ status: 'processing', attempts: (item.attempts || 0) + 1 })
        .eq('id', item.id);

      if (lockErr) {
        console.error(`[Worker] Lock failed for ${item.id}: ${lockErr.message}`);
        continue; // skip this item, don't crash
      }

      // 2. Clean the body text (strip --flowday-meta-- and internal JSON)
      const finalBody = cleanBody(item.body, item.title);

      // ─── STEP B: Web Push Delivery ───
      let pushSuccess = false;
      let pushResult: any = null;
      try {
        const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke('push', {
          body: {
            type: 'send',
            payload: {
              user_id: item.user_id,
              title: item.title,
              body: finalBody,
              url: '/tasks',
              entity_id: item.task_id || '',
              entity_type: 'task'
            }
          }
        });

        pushResult = invokeRes;

        // The push function returns { ok: true, sent: N } on success
        if (invokeErr) {
          console.error(`[Worker] Push invoke error for ${item.id}: ${invokeErr.message}`);
        } else if (invokeRes?.error && !invokeRes?.ok) {
          console.error(`[Worker] Push returned error for ${item.id}: ${invokeRes.error}`);
        } else {
          pushSuccess = true;
        }
      } catch (pushErr) {
        console.error(`[Worker] Push exception for ${item.id}: ${String(pushErr.message || pushErr)}`);
      }

      // ─── STEP C: Update queue status ───
      const finalStatus = 'sent'; // Mark sent to avoid re-processing
      try {
        await supabase
          .from('notification_queue')
          .update({ status: finalStatus, sent_at: new Date().toISOString() })
          .eq('id', item.id);
      } catch (updateErr) {
        console.error(`[Worker] Status update failed for ${item.id}: ${String(updateErr.message || updateErr)}`);
      }

      // ─── STEP D: Logs (best-effort, never throw) ───
      try {
        const logData = {
          user_id: item.user_id,
          notification_queue_id: item.id,
          status: pushSuccess ? 'sent' : 'failed',
          title: item.title,
          body: finalBody,
          sent_at: new Date().toISOString()
        };
        
        if (!pushSuccess) {
          logData.error_message = pushResult?.error || 'Push attempts failed';
        }
        
        await supabase.from('notification_logs').insert(logData);
      } catch (logErr) {
        console.error(`[Worker] Failed to write notification log: ${String(logErr.message || logErr)}`);
      }

      processedCount++;
    }

    return new Response(JSON.stringify({ message: 'Processing complete', processed: processedCount, workerId }), {
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
