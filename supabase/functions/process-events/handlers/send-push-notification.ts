import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.3';

/**
 * Handler para o evento 'send_push_notification' (ou 'SendPushNotification')
 * Dispara uma notificação push real utilizando as chaves VAPID do ambiente.
 */
export async function handleSendPushNotification(supabase: any, event: any) {
  const payload = event.payload || {};
  const userId = event.user_id || payload.user_id;
  const title = payload.title || 'MyFlowDay ⚡';
  const body = payload.body || '';
  const url = payload.url || '/tasks';
  const entityId = payload.entity_id || payload.id || '';
  const entityType = payload.entity_type || 'system';

  if (!userId) {
    throw new Error('user_id obrigatório para envio de notificação push.');
  }

  // 1. Buscar assinaturas de push cadastradas para o usuário
  const { data: subscriptions, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (subErr) {
    throw new Error(`Falha ao buscar push_subscriptions: ${subErr.message}`);
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { success: true, action: 'skipped', reason: 'Nenhuma assinatura cadastrada' };
  }

  // 2. Configurar chaves VAPID
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || Deno.env.get('VITE_PUBLIC_VAPID_KEY') || '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || Deno.env.get('PRIVATE_VAPID_KEY') || '';

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('Chaves VAPID (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) ausentes no ambiente.');
  }

  try {
    webpush.setVapidDetails('mailto:admin@myflowday.com', vapidPublicKey, vapidPrivateKey);
  } catch (e) {
    console.warn('[Push Event] Falha ao configurar VAPID:', e.message);
  }

  const payloadObj = {
    title,
    body,
    url,
    tag: `push_event_${userId}_${Date.now()}`,
    entity_id: entityId,
    entity_type: entityType,
    event_type: event.event_type || 'send_push_notification'
  };

  let sentCount = 0;
  let errorCount = 0;

  // 3. Enviar para cada dispositivo
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
      errorCount++;
      const statusCode = err.statusCode || err.status;
      console.warn(`[Push Event] Erro ao enviar para endpoint ${sub.endpoint.substring(0, 30)}:`, err.message);

      // Limpeza automática de endpoints inválidos ou expirados (404 Not Found, 410 Gone)
      if (statusCode === 404 || statusCode === 410) {
        console.log(`[Push Event] Endpoint expirado detectado (${statusCode}). Removendo inscrição.`);
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
    }
  }

  return {
    success: true,
    action: 'sent_push',
    sentCount,
    errorCount,
    totalDevices: subscriptions.length
  };
}
