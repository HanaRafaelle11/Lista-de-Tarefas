import webpush from 'web-push';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

const publicVapidKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_PUBLIC_VAPID_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || process.env.PRIVATE_VAPID_KEY || '';

if (publicVapidKey && privateVapidKey) {
  try {
    webpush.setVapidDetails('mailto:admin@myflowday.com', publicVapidKey, privateVapidKey);
  } catch (e) {
    logger.warn('notification.service.vapid_warning', { error: e.message });
  }
}

export async function processPendingNotificationQueue({ traceId }) {
  const now = new Date().toISOString();
  logger.info('notification.service.processPendingQueue.start', { traceId, timestamp: now });

  if (!supabaseAdmin) return { processed: 0, note: 'Mock environment' };

  const { data: queue, error } = await supabaseAdmin
    .from('notification_queue')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('scheduled_for', now)
    .lt('attempts', 5)
    .limit(50);

  if (error || !queue || queue.length === 0) return { processed: 0 };

  let processed = 0;
  for (const job of queue) {
    try {
      await supabaseAdmin.from('notification_queue').update({ status: 'processing' }).eq('id', job.id);

      const { data: subscriptions } = await supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', job.user_id);

      if (subscriptions && subscriptions.length > 0) {
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh || sub.keys?.p256dh, auth: sub.auth || sub.keys?.auth } },
              JSON.stringify({ title: job.title, body: job.body || '', url: '/tasks' })
            );
          } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            }
          }
        }
      }

      await supabaseAdmin.from('notification_queue').update({ status: 'sent', sent_at: now }).eq('id', job.id);
      await supabaseAdmin.from('notification_logs').insert({
        user_id: job.user_id,
        notification_queue_id: job.id,
        status: 'sent',
        title: job.title,
        body: job.body || '',
        sent_at: now
      });
      processed++;
    } catch (err) {
      await supabaseAdmin.from('notification_queue').update({ status: 'failed', last_error: err.message }).eq('id', job.id);
    }
  }

  logger.info('notification.service.processPendingQueue.finish', { traceId, processed });
  return { processed };
}
