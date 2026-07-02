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
      const fcmResults: Array<{
        subscription_id: string;
        endpoint: string;
        statusCode: number;
        success: boolean;
        message_id: string | null;
        error: string | null;
        raw_response: any;
      }> = [];

      for (const sub of subscriptions) {
        try {
          const result = await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh || (sub.keys as any)?.p256dh,
                auth: sub.auth || (sub.keys as any)?.auth
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

          const responseBody = result.body || '';
          const statusCode = result.statusCode || 0;
          const isOk = statusCode >= 200 && statusCode < 300;

          console.log(`[Push] Success → subId=${sub.id} status=${statusCode} body=${responseBody.substring(0, 200)}`);
          
          fcmResults.push({
            subscription_id: sub.id,
            endpoint: sub.endpoint,
            statusCode,
            success: isOk,
            message_id: responseBody.includes('projects/') || responseBody.includes('messages/') ? responseBody : null,
            error: null,
            raw_response: { body: responseBody, headers: result.headers }
          });
          
          if (isOk) {
            sentCount++;
          }
        } catch (err: any) {
          const statusCode = err?.statusCode || 0;
          const errBody = err?.body || err?.message || String(err);
          const errMsg = `status=${statusCode} body=${String(errBody).substring(0, 300)}`;
          console.error(`[Push] Failed → subId=${sub.id} ${errMsg}`);
          errors.push(errMsg);
          
          fcmResults.push({
            subscription_id: sub.id,
            endpoint: sub.endpoint,
            statusCode,
            success: false,
            message_id: null,
            error: errMsg,
            raw_response: { error: String(errBody) }
          });

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
        fcm_results: fcmResults,
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

    // ── DEDUP: Delete stale subscriptions older than 30 days globally.
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: cleanupErr } = await supabase
        .from('push_subscriptions')
        .delete()
        .lt('updated_at', thirtyDaysAgo);

      if (cleanupErr) {
        console.warn(`[Push Register] Stale cleanup warning: ${cleanupErr.message}`);
      } else {
        console.log(`[Push Register] Cleaned subscriptions older than 30 days globally`);
      }
    } catch (cleanupErr: any) {
      console.warn(`[Push Register] Cleanup error (non-fatal): ${cleanupErr?.message || cleanupErr}`);
    }

    // Check if the subscription with this endpoint already exists
    const { data: existingSub, error: fetchSubError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id')
      .eq('endpoint', endpoint)
      .maybeSingle();

    if (fetchSubError) {
      return new Response(JSON.stringify({ ok: false, error: 'Erro ao consultar assinatura existente', details: fetchSubError.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (existingSub) {
      // Existente -> atualiza (pode ser o mesmo usuário ou re-associação)
      const isSameUser = existingSub.user_id === user_id;
      const { error: updateErr } = await supabase
        .from('push_subscriptions')
        .update({
          user_id,
          p256dh: keys?.p256dh || null,
          auth: keys?.auth || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSub.id);

      if (updateErr) {
        return new Response(JSON.stringify({ ok: false, error: 'Erro ao atualizar assinatura existente', details: updateErr.message }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      console.log(`[Push Register] Subscription updated. Same user: ${isSameUser}, ID: ${existingSub.id}`);
      return new Response(JSON.stringify({ ok: true, registered: true, action: 'registro atualizado', id: existingSub.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    } else {
      // Nova assinatura -> insere
      const { data: insertRes, error: insertErr } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id,
          endpoint,
          p256dh: keys?.p256dh || null,
          auth: keys?.auth || null,
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertErr) {
        return new Response(JSON.stringify({ ok: false, error: 'Erro ao criar nova assinatura', details: insertErr.message }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      console.log(`[Push Register] New subscription created. ID: ${insertRes.id}`);
      return new Response(JSON.stringify({ ok: true, registered: true, action: 'registro criado', id: insertRes.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: 'Crash interno capturado', message: String(err?.message || err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      status: 200
    });
  }
});