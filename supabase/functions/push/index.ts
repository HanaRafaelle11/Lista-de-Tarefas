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

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE environment keys' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // Inicializa o client administrativo
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Validar autenticação do usuário
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user session context' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Obter payload
    let reqBody: any = null;
    try {
      reqBody = await req.json();
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Request body must be valid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { type, payload } = reqBody || {};

    // 3. Roteamento de comandos
    if (type === 'send') {
      const { user_id, title, body, url, entity_id, entity_type } = payload || {};
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'Missing user_id in payload for send operation' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Configura VAPID
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || Deno.env.get('VITE_PUBLIC_VAPID_KEY') || '';
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || Deno.env.get('PRIVATE_VAPID_KEY') || '';

      if (!vapidPublicKey || !vapidPrivateKey) {
        return new Response(JSON.stringify({ error: 'Missing VAPID configuration on server env' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        webpush.setVapidDetails('mailto:admin@myflowday.com', vapidPublicKey, vapidPrivateKey);
      } catch (e) {
        console.warn('[Push Service] VAPID configuration warning:', e.message);
      }

      // Buscar assinaturas
      const { data: subscriptions, error: fetchError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user_id);

      if (fetchError) {
        return new Response(JSON.stringify({ error: fetchError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0, msg: 'Nenhuma assinatura cadastrada para o usuário' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const payloadObj = {
        title: title || 'MyFlowDay ⚡',
        body: body || '',
        url: url || '/tasks',
        tag: `push_send_${user_id}_${Date.now()}`,
        entity_id: entity_id || '',
        entity_type: entity_type || 'system',
        event_type: 'send_push_notification',
        user_id,
        data: {
          url: url || '/tasks'
        }
      };

      let sentCount = 0;
      for (const sub of subscriptions) {
        // A) Registrar tentativa (sent_attempt)
        await supabase.from('push_telemetry').insert({
          user_id,
          endpoint: sub.endpoint,
          event_type: 'sent_attempt',
          status: 'success'
        });

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
          sentCount++;

          // B) Registro de entrega com sucesso no gateway (sent)
          await supabase.from('push_telemetry').insert({
            user_id,
            endpoint: sub.endpoint,
            event_type: 'sent',
            status: 'success'
          });
        } catch (err) {
          const statusCode = err.statusCode || err.status;
          console.warn(`[Push Service] Envio falhou para ${sub.endpoint.substring(0, 30)}:`, err.message);

          // C) Registro de falha (failed)
          await supabase.from('push_telemetry').insert({
            user_id,
            endpoint: sub.endpoint,
            event_type: 'failed',
            status: 'error',
            error: String(statusCode || err.message)
          });

          // Limpa endpoints expirados ou desinstalados automaticamente (404 / 410)
          if (statusCode === 404 || statusCode === 410) {
            console.log(`[Push Service] Limpando endpoint expirado (${statusCode})`);
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint);

            // D) Registro de limpeza (cleaned)
            await supabase.from('push_telemetry').insert({
              user_id,
              endpoint: sub.endpoint,
              event_type: 'cleaned',
              status: 'success'
            });
          }
        }
      }

      return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Default: 'register' (inserir/atualizar assinatura)
    const { user_id, endpoint, keys } = reqBody || {};
    
    if (!endpoint || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id or endpoint in payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Segurança: um usuário comum só pode registrar sua própria assinatura
    if (user.id !== user_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
