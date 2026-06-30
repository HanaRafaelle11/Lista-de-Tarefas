import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  // Intercepta estritamente o Preflight do celular para matar erro de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Falta chaves de sistema SUPABASE' }), {
        status: 200, // Força 200 para o gateway não mascarar com 500
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let reqBody: any = null;
    try {
      reqBody = await req.json();
    } catch (_) {
      return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 200, headers: corsHeaders });
    }

    const isSendOp = reqBody.type === 'send';
    const dataContainer = reqBody.payload ? reqBody.payload : reqBody;

    // OPERAÇÃO DE ENVIO (SEND)
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

      const { data: subscriptions, error: fetchError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user_id);

      if (fetchError) throw fetchError;

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200, headers: corsHeaders });
      }

      const payloadObj = {
        title: title || 'MyFlowDay ⚡',
        body: body || '',
        url: url || '/tasks',
        tag: `push_send_${user_id}_${Date.now()}`
      };

      let sentCount = 0;
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
            JSON.stringify(payloadObj)
          );
          sentCount++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      }

      return new Response(JSON.stringify({ ok: true, sent: sentCount }), { status: 200, headers: corsHeaders });
    }

    // OPERAÇÃO DE REGISTRO (REGISTER)
    const user_id = dataContainer.user_id || dataContainer.userId;
    const endpoint = dataContainer.endpoint;
    const keys = dataContainer.keys;

    if (!endpoint || !user_id) {
      return new Response(JSON.stringify({ error: 'Falta user_id ou endpoint no payload enviado' }), {
        status: 200,
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
      return new Response(JSON.stringify({ error: 'Erro de banco Postgres', details: upsertError.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true, registered: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    // Força o retorno como status 200 contendo o texto do erro para enganar o gateway e expor o log na telemetria
    return new Response(JSON.stringify({ error: 'Crash interno capturado', message: String(err.message || err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});