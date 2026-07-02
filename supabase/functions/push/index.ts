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
      return new Response(JSON.stringify({ ok: false, error: 'Falta chaves de sistema SUPABASE' }), {
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
      return new Response(JSON.stringify({ ok: false, error: 'JSON inválido ou codificação incorreta' }), { 
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
        return new Response(JSON.stringify({ ok: false, error: 'Falta user_id' }), { status: 200, headers: corsHeaders });
      }

      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || Deno.env.get('VITE_PUBLIC_VAPID_KEY') || '';
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || Deno.env.get('PRIVATE_VAPID_KEY') || '';

      if (!vapidPublicKey || !vapidPrivateKey) {
        return new Response(JSON.stringify({ ok: false, error: 'Falta chaves VAPID no servidor' }), { status: 200, headers: corsHeaders });
      }

      webpush.setVapidDetails('mailto:admin@myflowday.com', vapidPublicKey, vapidPrivateKey);

      // ── Fetch ALL subscriptions for the user (no artificial limit) ──
      const { data: subscriptions, error: fetchError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user_id)
        .order('updated_at', { ascending: false, nullsFirst: false });

      if (fetchError) {
        console.error(`[Push] Error fetching subscriptions for ${user_id}: ${fetchError.message}`);
        return new Response(JSON.stringify({ ok: false, error: `DB error: ${fetchError.message}`, sent: 0 }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      const totalFound = subscriptions?.length || 0;
      console.log(`[Push] Found ${totalFound} subscriptions for user ${user_id}`);

      if (!subscriptions || totalFound === 0) {
        console.warn(`[Push] No subscriptions found for user ${user_id}`);
        return new Response(JSON.stringify({ ok: false, sent: 0, error: 'no_subscriptions', total_found: 0 }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
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
      const errors: string[] = [];

      for (const sub of subscriptions) {
        try {
          const result = await webpush.sendNotification(
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
          
          console.log(`[Push] Success → endpoint=${sub.endpoint.substring(0, 50)}… status=${result.statusCode}`);
          sentCount++;
        } catch (err) {
          const statusCode = err.statusCode || 0;
          const errMsg = `status=${statusCode} msg=${err.message || err}`;
          console.error(`[Push] Failed → endpoint=${sub.endpoint?.substring(0, 50)}… ${errMsg}`);
          errors.push(errMsg);
          
          // Remove permanently dead endpoints (404, 410, 403)
          if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
            deadEndpoints.push(sub.endpoint);
          }
        }
      }

      // ── CLEANUP: Remove dead endpoints from the database ──
      for (const deadEp of deadEndpoints) {
        try {
          await supabase.from('push_subscriptions').delete().eq('endpoint', deadEp);
          console.log(`[Push Cleanup] Removed dead endpoint: ${deadEp.substring(0, 50)}…`);
        } catch (_) { /* best-effort cleanup */ }
      }

      // ── AUDIT RESPONSE: ok=true ONLY when at least 1 notification was delivered ──
      const isSuccess = sentCount > 0;
      
      return new Response(JSON.stringify({ 
        ok: isSuccess, 
        sent: sentCount,
        total_found: totalFound,
        dead_removed: deadEndpoints.length,
        errors: isSuccess ? undefined : errors.slice(0, 5),
        error: isSuccess ? undefined : `0/${totalFound} endpoints succeeded`
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
      return new Response(JSON.stringify({ ok: false, error: 'Falta user_id ou endpoint no payload enviado' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // ── DEDUP: Delete stale subscriptions older than 30 days for this user.
    //    This prevents indefinite growth of the push_subscriptions table
    //    while preserving multi-device support. ──
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: cleanupErr } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user_id)
        .lt('updated_at', thirtyDaysAgo);

      if (cleanupErr) {
        console.warn(`[Push Register] Stale cleanup warning: ${cleanupErr.message}`);
      } else {
        console.log(`[Push Register] Cleaned subscriptions older than 30 days for user ${user_id}`);
      }
    } catch (cleanupErr) {
      console.warn(`[Push Register] Cleanup error (non-fatal): ${cleanupErr.message}`);
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
      return new Response(JSON.stringify({ ok: false, error: 'Erro de banco Postgres', details: upsertError.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    return new Response(JSON.stringify({ ok: true, registered: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'Crash interno capturado', message: String(err.message || err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      status: 200
    });
  }
});