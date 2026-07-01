import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Falta chaves de sistema SUPABASE' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let reqBody: any = null;
    try {
      const buffer = await req.arrayBuffer();
      const decoded = new TextDecoder('utf-8').decode(buffer);
      reqBody = JSON.parse(decoded);
    } catch (_) {
      return new Response(JSON.stringify({ error: 'JSON inválido ou codificação incorreta' }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } 
      });
    }

    const isSendOp = reqBody.type === 'send';
    const dataContainer = reqBody.payload ? reqBody.payload : reqBody;

    // ══════════════════════════════════════════════════════════════
    // OPERAÇÃO DE ENVIO (SEND)
    // ══════════════════════════════════════════════════════════════
    if (isSendOp) {
      const { user_id, title, body, url } = dataContainer;
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'Falta user_id' }), { status: 200, headers: corsHeaders });
      }

      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || Deno.env.get('VITE_PUBLIC_VAPID_KEY') || '';
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || Deno.env.get('PRIVATE_VAPID_KEY') || '';

      if (!vapidPublicKey || !vapidPrivateKey) {
        return new Response(JSON.stringify({ error: 'Falta chaves VAPID no servidor' }), { status: 200, headers: corsHeaders });
      }

      webpush.setVapidDetails('mailto:admin@myflowday.com', vapidPublicKey, vapidPrivateKey);

      // ── PRIORITIZE: Fetch only the 3 most recent subscriptions per user ──
      const { data: subscriptions, error: fetchError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user_id)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(3);

      if (fetchError) {
        console.error(`[Push] Error fetching subscriptions for ${user_id}: ${fetchError.message}`);
        // Return ok:true so caller doesn't treat this as a hard failure
        return new Response(JSON.stringify({ ok: true, sent: 0, note: 'subscription_fetch_error' }), { 
          status: 200, headers: corsHeaders 
        });
      }

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0, note: 'no_subscriptions' }), { status: 200, headers: corsHeaders });
      }

      const payloadObj = {
        title: title || 'MyFlowDay ⚡',
        body: body || '',
        url: url || '/tasks',
        tag: `push_send_${user_id}_${Date.now()}`,
        entity_id: dataContainer.entity_id || '',
        entity_type: dataContainer.entity_type || 'system',
        event_type: dataContainer.event_type || 'TASK_DUE',
        notification_id: dataContainer.notification_id || '',
        user_id: user_id
      };

      let sentCount = 0;
      const deadEndpoints: string[] = [];

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh || sub.keys?.p256dh,
                auth: sub.auth || sub.keys?.auth
              }
            },
            JSON.stringify(payloadObj),
            {
              headers: {
                'Urgency': 'high',
                'TTL': '86400'
              }
            }
          );
          sentCount++;
        } catch (err) {
          console.error(`[WebPush Error] User: ${user_id}, Endpoint: ${sub.endpoint?.substring(0, 60)}..., StatusCode: ${err.statusCode}, Msg: ${err.message || err}`);
          
          // Remove dead endpoints (404, 410, or any 4xx/5xx that indicates permanent failure)
          if (err.statusCode === 404 || err.statusCode === 410 || err.statusCode === 403) {
            deadEndpoints.push(sub.endpoint);
          }
        }
      }

      // ── CLEANUP: Remove dead endpoints from the database ──
      for (const deadEp of deadEndpoints) {
        try {
          await supabase.from('push_subscriptions').delete().eq('endpoint', deadEp);
          console.log(`[Push Cleanup] Removed dead endpoint: ${deadEp.substring(0, 60)}...`);
        } catch (_) { /* best-effort cleanup */ }
      }

      // IMPORTANT: Always return ok:true so the caller (process-notification-queue)
      // never treats push delivery issues as a reason to keep retrying forever.
      return new Response(JSON.stringify({ 
        ok: true, 
        sent: sentCount,
        total_endpoints: subscriptions.length,
        dead_removed: deadEndpoints.length
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } 
      });
    }

    // ══════════════════════════════════════════════════════════════
    // OPERAÇÃO DE REGISTRO (REGISTER)
    // ══════════════════════════════════════════════════════════════
    const user_id = dataContainer.user_id || dataContainer.userId;
    const endpoint = dataContainer.endpoint;
    const keys = dataContainer.keys;

    if (!endpoint || !user_id) {
      return new Response(JSON.stringify({ error: 'Falta user_id ou endpoint no payload enviado' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    const { error: upsertError } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id,
        endpoint,
        p256dh: keys?.p256dh || null,
        auth: keys?.auth || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'endpoint'
      });

    if (upsertError) {
      return new Response(JSON.stringify({ error: 'Erro de banco Postgres', details: upsertError.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    return new Response(JSON.stringify({ ok: true, registered: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Crash interno capturado', message: String(err.message || err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      status: 200
    });
  }
});