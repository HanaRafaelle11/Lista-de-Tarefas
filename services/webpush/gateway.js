import { supabaseAdmin } from '../supabase/client.js';
import { logger } from '../logger/logger.js';

/**
 * Envia notificações web push para um usuário delegando o disparo
 * para a única Edge Function 'push'.
 */
export async function sendWebPushToUser(userId, payloadObj) {
  if (!supabaseAdmin) return { success: false, reason: 'Supabase admin client not initialized' };

  try {
    const { data: invokeRes, error: invokeErr } = await supabaseAdmin.functions.invoke('push', {
      body: {
        type: 'send',
        payload: {
          user_id: userId,
          title: payloadObj.title,
          body: payloadObj.body || '',
          url: payloadObj.url || '/tasks',
          entity_id: payloadObj.entity_id || '',
          entity_type: payloadObj.entity_type || 'system'
        }
      }
    });

    if (invokeErr) throw invokeErr;
    if (invokeRes?.error) throw new Error(invokeRes.error);

    const sentCount = invokeRes?.sent || 0;
    logger.info('services.webpush.gateway.delegate.success', { userId, sentCount });
    return { success: sentCount > 0, count: sentCount };
  } catch (err) {
    logger.error('services.webpush.gateway.delegate.error', { userId, error: err.message });
    return { success: false, reason: err.message };
  }
}

