import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Returns a future ISO timestamp for the next retry attempt using exponential backoff.
 */
function getExponentialBackoffTime(attempts: number): string {
  const minutes = attempts <= 1 ? 2 : attempts === 2 ? 5 : attempts === 3 ? 15 : 30;
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

/**
 * Strips the internal --flowday-meta-- block from notification body text.
 * Returns a clean, user-friendly string.
 */
function cleanBody(raw: string | null | undefined, title: string): string {
  if (!raw) return `Sua tarefa "${title}" vence agora no MyFlowDay.`;
  let cleaned = raw.split('--flowday-meta--')[0].trim();
  cleaned = cleaned.replace(/\{[\s\S]*?"due_time"[\s\S]*?\}/g, '').trim();
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
      .limit(50);

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

    let successCount = 0;
    let failCount = 0;

    for (const item of queue) {
      const currentAttempt = (item.attempts || 0) + 1;

      // ─── STEP A: Lock — mark as processing ───
      const { error: lockErr } = await supabase
        .from('notification_queue')
        .update({ status: 'processing', attempts: currentAttempt })
        .eq('id', item.id);

      if (lockErr) {
        console.error(`[Worker] Lock failed for ${item.id}: ${lockErr.message}`);
        continue;
      }

      // ─── STEP B: Clean the body text ───
      const finalBody = cleanBody(item.body, item.title);

      // ─── STEP C: Web Push Delivery ───
      let pushSuccess = false;
      let pushResult: any = null;
      let pushErrorMsg = '';

      try {
        const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke('push', {
          body: {
            type: 'send',
            payload: {
              user_id: item.user_id,
              title: item.title,
              body: finalBody,
              url: '/tasks',
              entity_id: item.task_id || item.entity_id || '',
              entity_type: item.entity_type || 'task'
            }
          }
        });

        pushResult = invokeRes;

        if (invokeErr) {
          pushErrorMsg = `Edge Function invoke error: ${invokeErr.message}`;
          console.error(`[Worker] ${pushErrorMsg} (item=${item.id})`);
        } else if (!invokeRes?.ok) {
          // push returned ok:false — real delivery failure
          pushErrorMsg = invokeRes?.error || `Push returned ok:false, sent:${invokeRes?.sent || 0}`;
          console.error(`[Worker] Push delivery failed for ${item.id}: ${pushErrorMsg}`);
        } else if (invokeRes?.ok && invokeRes?.sent > 0) {
          pushSuccess = true;
          console.log(`[Worker] Push delivery OK for ${item.id}: sent=${invokeRes.sent}, dead_removed=${invokeRes.dead_removed || 0}`);
        } else {
          // ok:true but sent:0 — should not happen with new push code, but handle defensively
          pushErrorMsg = `Push returned ok:true but sent:0 (total_found=${invokeRes?.total_found || 0})`;
          console.warn(`[Worker] ${pushErrorMsg} (item=${item.id})`);
        }
      } catch (pushErr) {
        pushErrorMsg = `Push exception: ${String(pushErr.message || pushErr)}`;
        console.error(`[Worker] ${pushErrorMsg} (item=${item.id})`);
      }

      // ─── STEP D: Update queue status based on REAL result ───
      try {
        if (pushSuccess) {
          // ✅ Real success — mark as sent
          await supabase
            .from('notification_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              last_error: null
            })
            .eq('id', item.id);
          successCount++;
        } else if (currentAttempt >= 5) {
          // ❌ Max retries exhausted — mark as permanently failed
          await supabase
            .from('notification_queue')
            .update({
              status: 'failed',
              last_error: `[final] ${pushErrorMsg}`
            })
            .eq('id', item.id);
          failCount++;
        } else {
          // 🔄 Retry — mark as failed with next scheduled_for using backoff
          const nextRetry = getExponentialBackoffTime(currentAttempt);
          await supabase
            .from('notification_queue')
            .update({
              status: 'failed',
              scheduled_for: nextRetry,
              last_error: `[attempt ${currentAttempt}/5] ${pushErrorMsg}`
            })
            .eq('id', item.id);
          failCount++;
          console.log(`[Worker] Scheduled retry #${currentAttempt + 1} for ${item.id} at ${nextRetry}`);
        }
      } catch (updateErr) {
        console.error(`[Worker] Status update failed for ${item.id}: ${String(updateErr.message || updateErr)}`);
      }

      // ─── STEP E: Audit log (best-effort, never throw) ───
      try {
        await supabase.from('notification_logs').insert({
          user_id: item.user_id,
          notification_queue_id: item.id,
          status: pushSuccess ? 'sent' : 'failed',
          title: item.title,
          body: finalBody,
          sent_at: pushSuccess ? new Date().toISOString() : null,
          error_message: pushSuccess ? null : pushErrorMsg
        });
      } catch (logErr) {
        console.error(`[Worker] Failed to write notification log: ${String(logErr.message || logErr)}`);
      }
    }

    const elapsed = Date.now() - startTime;
    return new Response(JSON.stringify({
      message: 'Processing complete',
      processed: queue.length,
      sent: successCount,
      failed: failCount,
      elapsed_ms: elapsed,
      workerId
    }), {
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
