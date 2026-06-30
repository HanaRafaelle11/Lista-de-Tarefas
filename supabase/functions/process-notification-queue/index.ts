import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.3';

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
  const workerId = `worker_${startTime}_${Math.random().toString(36).substring(2, 7)}`;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || Deno.env.get('VITE_PUBLIC_VAPID_KEY') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || Deno.env.get('PRIVATE_VAPID_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE environment keys' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (vapidPublicKey && vapidPrivateKey) {
      try {
        webpush.setVapidDetails('mailto:admin@myflowday.com', vapidPublicKey, vapidPrivateKey);
      } catch (e) {
        console.warn('VAPID setVapidDetails warning:', e.message);
      }
    }

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

    // Grouping by user for batch push
    const groupedByUser: Record<string, typeof queue> = {};
    queue.forEach(item => {
      if (!groupedByUser[item.user_id]) groupedByUser[item.user_id] = [];
      groupedByUser[item.user_id].push(item);
    });

    let processedCount = 0;

    for (const [userId, items] of Object.entries(groupedByUser)) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

      const isGrouped = items.length > 1;
      const firstItem = items[0];

      const payloadObj = isGrouped ? {
        title: 'MyFlowDay ⚡',
        body: `Você possui ${items.length} atividades agendadas para agora!`,
        url: '/tasks',
        tag: `group_push_${Date.now()}`,
        grouped_count: items.length,
        items: items.map(i => ({ title: i.title, id: i.entity_id }))
      } : {
        title: firstItem.title,
        body: firstItem.body || '',
        url: firstItem.entity_type === 'focus' ? '/focus' : firstItem.entity_type === 'goal' ? '/goals' : '/tasks',
        tag: `push_${firstItem.entity_type}_${firstItem.entity_id}`,
        entity_id: firstItem.entity_id,
        entity_type: firstItem.entity_type,
        event_type: firstItem.event_type,
        notification_id: firstItem.id
      };

      for (const item of items) {
        await supabase
          .from('notification_queue')
          .update({ status: 'processing', attempts: (item.attempts || 0) + 1, updated_at: new Date().toISOString() })
          .eq('id', item.id);

        await supabase.from('in_app_notifications').insert({
          user_id: userId,
          notification_queue_id: item.id,
          event_type: item.event_type,
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          title: item.title,
          body: item.body
        });
      }

      if (!subscriptions || subscriptions.length === 0) {
        for (const item of items) {
          await supabase.from('notification_queue').update({ status: 'failed', last_error: 'No push subscriptions', updated_at: new Date().toISOString() }).eq('id', item.id);
          await supabase.from('notification_logs').insert({
            user_id: userId,
            notification_queue_id: item.id,
            status: 'failed',
            title: item.title,
            body: item.body,
            error_message: 'No push subscriptions'
          });
        }
        continue;
      }

      for (const sub of subscriptions || []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh || sub.keys?.p256dh, auth: sub.auth || sub.keys?.auth } },
            JSON.stringify(payloadObj)
          );

          for (const item of items) {
            await supabase.from('notification_queue').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', item.id);
            await supabase.from('notification_analytics').insert({ user_id: userId, notification_id: item.id, event: 'sent', metadata: payloadObj });
            await supabase.from('notification_logs').insert({
              user_id: userId,
              notification_queue_id: item.id,
              status: 'sent',
              title: item.title,
              body: item.body,
              payload: payloadObj
            });
            processedCount++;
          }
        } catch (err) {
          const statusCode = err.statusCode || err.status;
          const errMsg = String(err.message || err);

          for (const item of items) {
            const nextRetry = getExponentialBackoffTime((item.attempts || 0) + 1);
            await supabase.from('notification_queue').update({ status: 'failed', scheduled_for: nextRetry, last_error: errMsg, updated_at: new Date().toISOString() }).eq('id', item.id);
            await supabase.from('notification_analytics').insert({ user_id: userId, notification_id: item.id, event: 'failed', metadata: { error: errMsg } });
            await supabase.from('notification_logs').insert({
              user_id: userId,
              notification_queue_id: item.id,
              status: 'failed',
              title: item.title,
              body: item.body,
              error_message: errMsg
            });
          }

          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      }
    }

    return new Response(JSON.stringify({ message: 'E2E Worker execution completed', processed: processedCount, workerId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err), workerId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
