/**
 * Envia uma notificação push estruturada delegando a chamada para a Edge Function 'push'.
 * Garante que o pipeline seja 100% centralizado e unificado.
 */
export async function sendPushNotification(supabaseClient, userId, notificationData) {
  if (!userId || !supabaseClient) return { success: false, reason: 'Missing userId or supabaseClient' };
  
  const { title, body, url = '/', entity_id, entity_type, tag } = notificationData;

  try {
    const { data: invokeRes, error: invokeErr } = await supabaseClient.functions.invoke('push', {
      body: {
        type: 'send',
        payload: {
          user_id: userId,
          title,
          body: body || '',
          url,
          entity_id: entity_id || '',
          entity_type: entity_type || 'system',
          tag
        }
      }
    });

    if (invokeErr) throw invokeErr;
    if (invokeRes?.error) throw new Error(invokeRes.error);

    const sentCount = invokeRes?.sent || 0;
    return {
      success: sentCount > 0,
      sentCount,
      failedCount: sentCount === 0 ? 1 : 0
    };
  } catch (err) {
    console.error('[Web Push] Error delegating to Edge Function push:', err.message);
    return { success: false, reason: err.message };
  }
}

