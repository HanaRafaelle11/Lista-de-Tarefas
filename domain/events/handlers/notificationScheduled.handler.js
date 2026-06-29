import { logger } from '../../../services/logger/logger.js';
import { sendWebPushToUser } from '../../../services/webpush/gateway.js';

export async function handleNotificationScheduled(payload) {
  logger.info('[DomainHandler] Processando notification.scheduled via WebPush', payload);
  
  if (payload && payload.user_id) {
    const pushPayload = {
      title: payload.title || 'MyFlowDay ⚡',
      body: payload.body || 'Você possui uma notificação agendada.',
      url: payload.url || '/tasks'
    };
    await sendWebPushToUser(payload.user_id, pushPayload);
  }

  return { success: true, handled: 'notification.scheduled' };
}
