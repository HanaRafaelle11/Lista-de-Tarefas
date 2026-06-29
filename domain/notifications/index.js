import { supabaseAdmin } from '../../services/supabase/index.js';
import { logger } from '../../services/logger/index.js';
import { sendWebPushToUser } from '../../services/webpush/index.js';

export async function scheduleNotification({ userId, title, body, scheduledFor, entityId, entityType }) {
  logger.info('domain.notifications.scheduleNotification', { userId, title });
  if (!userId || !title) throw new Error('userId and title are required');

  if (!supabaseAdmin) return { id: `notif_mock_${Date.now()}`, userId, title, status: 'pending' };

  const { data, error } = await supabaseAdmin
    .from('notification_queue')
    .insert({
      user_id: userId,
      title,
      body: body || '',
      scheduled_for: scheduledFor || new Date().toISOString(),
      entity_id: entityId,
      entity_type: entityType || 'task',
      status: 'pending'
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function processNotificationQueue() {
  const now = new Date().toISOString();
  logger.info('domain.notifications.processNotificationQueue', { now });

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
      await sendWebPushToUser(job.user_id, { title: job.title, body: job.body });
      await supabaseAdmin.from('notification_queue').update({ status: 'sent', sent_at: now }).eq('id', job.id);
      processed++;
    } catch (err) {
      await supabaseAdmin.from('notification_queue').update({ status: 'failed', last_error: err.message }).eq('id', job.id);
    }
  }

  return { processed };
}
