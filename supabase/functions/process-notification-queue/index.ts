import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
      return new Response(JSON.stringify({ message: 'No pending notifications', processed: 0 }), {
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

      if (!subscriptions || subscriptions.length === 0) {
        await supabase
          .from('notification_queue')
          .update({ status: 'failed' })
          .eq('id', item.id);

        await supabase.from('notification_logs').insert({
          notification_id: item.id,
          task_id: item.task_id,
          user_id: item.user_id,
          status: 'failed',
          error: 'No active push subscriptions found for user'
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
            JSON.stringify({
              title: item.title,
              body: item.body || '',
              url: '/tasks',
              tag: `task_push_${item.task_id}`
            })
          );

          await supabase
            .from('notification_queue')
            .update({ status: 'success', updated_at: new Date().toISOString() })
            .eq('id', item.id);
            
          processedCount++;
        } catch (err) {
          await supabase
            .from('notification_queue')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', item.id);

          await supabase.from('notification_logs').insert({
            notification_id: item.id,
            task_id: item.task_id,
            user_id: item.user_id,
            status: 'failed',
            error: String(err.message || err)
          });
        }
      }
    }

    return new Response(JSON.stringify({ message: 'Execution completed', processed: processedCount }), {
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
