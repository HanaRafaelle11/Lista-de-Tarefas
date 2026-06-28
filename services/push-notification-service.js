import webpush from 'web-push';

// Configure web-push with VAPID details
const publicVapidKey = process.env.VITE_PUBLIC_VAPID_KEY || 'BFsU8y-mock-key';
const privateVapidKey = process.env.PRIVATE_VAPID_KEY || 'mock-private-key';

try {
  webpush.setVapidDetails(
    'mailto:support@flowday.app',
    publicVapidKey,
    privateVapidKey
  );
} catch (err) {
  console.warn('[Web Push] VAPID initialization warning:', err.message);
}

/**
 * Sends a structured web push notification payload to all active subscriptions of a user.
 * Automatically cleans up expired (404/410) subscriptions.
 */
export async function sendPushNotification(supabaseClient, userId, notificationData) {
  if (!userId || !supabaseClient) return { success: false, reason: 'Missing userId or supabaseClient' };
  
  const { title, body, url = '/', entity_id, entity_type, tag } = notificationData;

  try {
    // 1. Fetch push subscriptions for the user
    const { data: subscriptions, error } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('[Web Push] Error fetching subscriptions:', error.message);
      return { success: false, reason: error.message };
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[Web Push] No active push subscriptions found for user: ${userId}`);
      return { success: false, reason: 'No subscriptions found for user' };
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
      tag: tag || `notif_${entity_type || 'system'}_${entity_id || Date.now()}`,
      entity_id,
      entity_type,
      timestamp: new Date().toISOString()
    });

    let sentCount = 0;
    let failedCount = 0;

    const promises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        sentCount++;
      } catch (err) {
        failedCount++;
        console.warn(`[Web Push] Failed to send to ${sub.endpoint}:`, err.message);
        // Clean up expired/gone subscriptions automatically
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[Web Push] Removing expired subscription for endpoint ${sub.endpoint}`);
          await supabaseClient
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      }
    });

    await Promise.all(promises);
    return { success: sentCount > 0, sentCount, failedCount };
  } catch (err) {
    console.error('[Web Push] Unexpected error sending push notification:', err.message);
    return { success: false, reason: err.message };
  }
}
