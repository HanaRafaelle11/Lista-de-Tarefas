import webpush from 'web-push';
import { supabaseAdmin } from '../lib/supabase.js';

// Configure web-push with VAPID details
const publicVapidKey = process.env.VITE_PUBLIC_VAPID_KEY;
const privateVapidKey = process.env.PRIVATE_VAPID_KEY;

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(
    'mailto:support@flowday.app',
    publicVapidKey,
    privateVapidKey
  );
} else {
  console.warn('[Web Push] VAPID keys not configured in environment.');
}

/**
 * Sends a web push notification to all active subscriptions of a user.
 * Automatically cleans up expired (404/410) subscriptions.
 */
export async function sendPushNotification(userId, title, body, url = '/') {
  if (!userId) return;
  
  try {
    // 1. Fetch subscriptions for the user
    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('[Web Push] Error fetching subscriptions:', error.message);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[Web Push] No active push subscriptions found for user: ${userId}`);
      return;
    }

    console.log(`[Web Push] Sending push to ${subscriptions.length} devices for user ${userId}...`);

    const payload = JSON.stringify({ title, body, url });

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
      } catch (err) {
        console.warn(`[Web Push] Failed to send to ${sub.endpoint}:`, err.message);
        // Clean up expired/gone subscriptions
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[Web Push] Removing expired subscription for endpoint ${sub.endpoint}`);
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      }
    });

    await Promise.all(promises);
  } catch (err) {
    console.error('[Web Push] Unexpected error sending push notification:', err.message);
  }
}
