import { supabaseAdmin } from '../../services/supabase/client.js';
import { logger } from '../../services/logger/logger.js';
import { sendWebPushToUser } from '../../services/webpush/gateway.js';

export default async function handler(req, res) {
  const now = new Date().toISOString();

  if (!supabaseAdmin) {
    return res.status(200).json({ processed: 0, note: 'Supabase admin not configured in local environment', timestamp: now });
  }

  try {
    const { data: queue, error } = await supabaseAdmin
      .from('notification_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('scheduled_for', now)
      .lt('attempts', 5)
      .order('scheduled_for', { ascending: true })
      .limit(100);

    if (error) return res.status(500).json({ error: error.message });
    if (!queue || queue.length === 0) return res.status(200).json({ processed: 0, timestamp: now });

    let processed = 0;

    for (const job of queue) {
      try {
        const { data: existing } = await supabaseAdmin
          .from('notification_logs')
          .select('id')
          .eq('user_id', job.user_id)
          .eq('status', 'sent')
          .eq('notification_queue_id', job.id)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin.from('notification_queue').update({ status: 'sent', updated_at: now }).eq('id', job.id);
          continue;
        }

        await supabaseAdmin.from('notification_queue').update({ status: 'processing', attempts: (job.attempts || 0) + 1, updated_at: now }).eq('id', job.id);
        const pushResult = await sendWebPushToUser(job.user_id, {
          title: job.title,
          body: job.body || '',
          url: job.entity_type === 'focus' ? '/focus' : job.entity_type === 'goal' ? '/goals' : '/tasks',
          tag: `push_${job.entity_type || 'task'}_${job.entity_id || job.id}`
        });

        await supabaseAdmin.from('notification_queue').update({ status: 'sent', sent_at: now, updated_at: now }).eq('id', job.id);
        await supabaseAdmin.from('notification_logs').insert({
          user_id: job.user_id,
          notification_queue_id: job.id,
          status: 'sent',
          title: job.title,
          body: job.body || '',
          payload: pushResult || {},
          sent_at: now
        });
        processed++;
      } catch (err) {
        const errMsg = String(err.message || err);
        await supabaseAdmin.from('notification_queue').update({ status: 'failed', last_error: errMsg, updated_at: now }).eq('id', job.id);
        await supabaseAdmin.from('notification_logs').insert({
          user_id: job.user_id,
          notification_queue_id: job.id,
          status: 'failed',
          title: job.title || 'Notification',
          error_message: errMsg,
          sent_at: now
        });
      }
    }

    return res.status(200).json({ processed, timestamp: now });
  } catch (globalErr) {
    logger.error('[NotificationWorker] Erro crítico no worker:', { error: globalErr.message });
    return res.status(500).json({ error: globalErr.message || String(globalErr) });
  }
}
