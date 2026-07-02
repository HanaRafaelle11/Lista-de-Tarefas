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

    // Fetch and lock pending or failed retryable notifications using RPC
    const { data: queue, error: queueError } = await supabase.rpc('claim_pending_notifications', {
      worker_id_val: workerId,
      limit_val: 50
    });

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
      const currentAttempt = item.attempts || 1;

      // ─── STEP B: Clean the body text ───
      const finalBody = cleanBody(item.body, item.title);

      // ─── STEP C: Web Push Delivery ───
      let pushSuccess = false;
      let pushResult: any = null;
      let pushErrorMsg = '';
      
      // FCM evidence fields
      let providerStatus: number | null = null;
      let providerMessageId: string | null = null;
      let providerResponse: string | null = null;

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
              entity_type: item.entity_type || 'task',
              notification_id: item.id
            }
          }
        });

        pushResult = invokeRes;

        // Extract FCM evidence from the push response
        if (invokeRes?.fcm_results && Array.isArray(invokeRes.fcm_results) && invokeRes.fcm_results.length > 0) {
          const firstResult = invokeRes.fcm_results[0];
          providerStatus = firstResult.statusCode || null;
          providerMessageId = firstResult.message_id || null;
          providerResponse = JSON.stringify(invokeRes.fcm_results);
        }

        if (invokeErr) {
          pushErrorMsg = `Edge Function invoke error: ${invokeErr.message}`;
          console.error(`[Worker] ${pushErrorMsg} (item=${item.id})`);
        } else if (!invokeRes?.ok) {
          pushErrorMsg = invokeRes?.error || `Push returned ok:false, sent:${invokeRes?.sent || 0}`;
          console.error(`[Worker] Push delivery failed for ${item.id}: ${pushErrorMsg}`);
        } else if (invokeRes?.ok && invokeRes?.sent > 0) {
          pushSuccess = true;
          console.log(`[Worker] Push delivery OK for ${item.id}: sent=${invokeRes.sent}, provider_status=${providerStatus}`);
        } else {
          pushErrorMsg = `Push returned ok:true but sent:0 (total_found=${invokeRes?.total_found || 0})`;
          console.warn(`[Worker] ${pushErrorMsg} (item=${item.id})`);
        }
      } catch (pushErr) {
        pushErrorMsg = `Push exception: ${String(pushErr.message || pushErr)}`;
        console.error(`[Worker] ${pushErrorMsg} (item=${item.id})`);
      }

      // ─── STEP D: Insert Per-Device Deliveries (Truth Layer) ───
      let successDevices = 0;
      let totalDevices = 0;

      if (pushResult?.fcm_results && Array.isArray(pushResult.fcm_results) && pushResult.fcm_results.length > 0) {
        totalDevices = pushResult.fcm_results.length;
        const deliveriesToInsert = pushResult.fcm_results.map((res: any) => {
          if (res.success) successDevices++;
          return {
            notification_id: item.id,
            user_id: item.user_id,
            push_subscription_id: res.subscription_id,
            status: res.success ? 'sent' : 'failed',
            provider_response: res.raw_response,
            message_id: res.message_id,
            error_message: res.error
          };
        });

        const { error: insertErr } = await supabase.from('notification_deliveries').insert(deliveriesToInsert);
        if (insertErr) {
          console.error(`[Worker] Error inserting notification_deliveries for item ${item.id}: ${insertErr.message}`);
        }
      } else {
        // No subscriptions found or push failed completely before loop
        const { error: insertErr } = await supabase.from('notification_deliveries').insert({
          notification_id: item.id,
          user_id: item.user_id,
          status: 'failed',
          error_message: pushErrorMsg || 'no_subscriptions',
          provider_response: pushResult ? { raw: pushResult } : null
        });
        if (insertErr) {
          console.error(`[Worker] Error inserting fallback delivery: ${insertErr.message}`);
        }
      }

      // ─── STEP E: Update queue status based on REAL result + persist FCM evidence ───
      try {
        let finalStatus = 'failed';
        if (successDevices === totalDevices && totalDevices > 0) {
          finalStatus = 'completed'; // fully_delivered
        } else if (successDevices > 0) {
          finalStatus = 'completed'; // partially_delivered
        }

        if (finalStatus === 'completed') {
          // ✅ Real success — mark as completed with provider evidence
          await supabase
            .from('notification_queue')
            .update({
              status: 'completed',
              sent_at: new Date().toISOString(),
              last_error: null,
              provider_status: providerStatus,
              provider_message_id: providerMessageId,
              provider_response: providerResponse
            })
            .eq('id', item.id);
          successCount++;
        } else if (currentAttempt >= 5) {
          // ❌ Max retries exhausted — mark as permanently failed with provider evidence
          await supabase
            .from('notification_queue')
            .update({
              status: 'failed',
              last_error: `[final] ${pushErrorMsg || 'all_devices_failed'}`,
              provider_status: providerStatus,
              provider_message_id: providerMessageId,
              provider_response: providerResponse
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
              last_error: `[attempt ${currentAttempt}/5] ${pushErrorMsg || 'all_devices_failed'}`,
              provider_status: providerStatus,
              provider_response: providerResponse
            })
            .eq('id', item.id);
          failCount++;
          console.log(`[Worker] Scheduled retry #${currentAttempt + 1} for ${item.id} at ${nextRetry}`);
        }
      } catch (updateErr) {
        console.error(`[Worker] Status update failed for ${item.id}: ${String(updateErr.message || updateErr)}`);
      }

      // ─── STEP F: Audit log with FCM evidence (best-effort, never throw) ───
      try {
        await supabase.from('notification_logs').insert({
          user_id: item.user_id,
          notification_queue_id: item.id,
          status: successDevices > 0 ? 'sent' : 'failed',
          title: item.title,
          body: finalBody,
          sent_at: successDevices > 0 ? new Date().toISOString() : null,
          error_message: successDevices > 0 ? null : (pushErrorMsg || 'all_devices_failed'),
          provider_status: providerStatus,
          provider_message_id: providerMessageId,
          provider_response: providerResponse
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
