import webpush from 'web-push';
import { supabaseAdmin } from '../supabase/index.js';
import { logger } from '../logger/index.js';

const publicVapidKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_PUBLIC_VAPID_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || process.env.PRIVATE_VAPID_KEY || '';

if (publicVapidKey && privateVapidKey) {
  try {
    webpush.setVapidDetails('mailto:admin@myflowday.com', publicVapidKey, privateVapidKey);
  } catch (e) {
    logger.warn('VAPID initialization warning', { error: e.message });
  }
}

export async function sendWebPushToUser(userId, payloadObj) {
  if (!supabaseAdmin) return { success: false, reason: 'Supabase admin client not initialized' };

  const { data: subscriptions } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (!subscriptions || subscriptions.length === 0) return { success: true, count: 0 };

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh || sub.keys?.p256dh, auth: sub.auth || sub.keys?.auth } },
        JSON.stringify(payloadObj)
      );
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }
  return { success: true, count: sent };
}
