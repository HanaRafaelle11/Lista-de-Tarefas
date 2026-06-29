import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const startTime = Date.now();
  const jobId = `job_${startTime}_${Math.random().toString(36).substring(2, 7)}`;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || Deno.env.get('VITE_PUBLIC_VAPID_KEY') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE environment keys' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (vapidPublicKey && vapidPrivateKey) {
      try {
        webpush.setVapidDetails(
          'mailto:admin@myflowday.com',
          vapidPublicKey,
          vapidPrivateKey
        );
      } catch (e) {
        console.warn('VAPID setVapidDetails warning:', e.message);
      }
    }

    // 1. Fetch pending items scheduled for now or earlier
    const { data: queue, error: queueError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(100);

    if (queueError) {
      return new Response(JSON.stringify({ error: queueError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    if (!queue?.length) {
      return new Response(JSON.stringify({ message: 'No pending notifications', processed: 0, jobId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    let processedCount = 0;

    for (const item of queue) {
      await supabase
        .from('notification_queue')
        .update({ status: 'processing' })
        .eq('id', item.id);

      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', item.user_id);

      const payloadObj = {
        title: item.title,
        body: item.body || '',
        url: '/tasks',
        tag: `task_push_${item.task_id}`
      };

      if (!subscriptions || subscriptions.length === 0) {
        await supabase
          .from('notification_queue')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', item.id);

        await supabase.from('notification_logs').insert({
          job_id: jobId,
          notification_id: item.id,
          task_id: item.task_id,
          user_id: item.user_id,
          subscription: 'none',
          status: 'failed',
          error: 'No active push subscriptions found for user',
          tempo_execucao: Date.now() - startTime,
          payload: payloadObj
        });
        continue;
      }

      for (const sub of subscriptions || []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh || sub.keys?.p256dh,
                auth: sub.auth || sub.keys?.auth
              }
            },
            JSON.stringify(payloadObj)
          );

          await supabase
            .from('notification_queue')
            .update({ status: 'success', updated_at: new Date().toISOString() })
            .eq('id', item.id);

          await supabase.from('notification_logs').insert({
            job_id: jobId,
            notification_id: item.id,
            task_id: item.task_id,
            user_id: item.user_id,
            subscription: sub.endpoint,
            status: 'success',
            error: null,
            tempo_execucao: Date.now() - startTime,
            payload: payloadObj
          });
            
          processedCount++;
        } catch (err) {
          const statusCode = err.statusCode || err.status;
          
          await supabase
            .from('notification_queue')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', item.id);

          // Limpeza automática de assinaturas inválidas (404 / 410 Gone)
          if (statusCode === 404 || statusCode === 410) {
            console.log(`[Worker] Cleaned expired subscription: ${sub.endpoint}`);
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint);
          }

          await supabase.from('notification_logs').insert({
            job_id: jobId,
            notification_id: item.id,
            task_id: item.task_id,
            user_id: item.user_id,
            subscription: sub.endpoint,
            status: 'failed',
            error: String(err.message || err),
            tempo_execucao: Date.now() - startTime,
            payload: payloadObj
          });
        }
      }
    }

    return new Response(JSON.stringify({ message: 'Execution completed', processed: processedCount, jobId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err), jobId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
