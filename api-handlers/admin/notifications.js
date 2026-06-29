import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../services/logger/index.js';

export default async function handler(req, res) {
  const start = Date.now();

  try {
    const { data: queueData, error: qErr } = await supabaseAdmin
      .from('notification_queue')
      .select('id, event_type, entity_type, scheduled_for, status, attempts, last_error, created_at, sent_at, clicked_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (qErr) throw qErr;

    logger.info('api.admin.notifications.success', { latency: Date.now() - start });
    return res.status(200).json(queueData);
  } catch (err) {
    logger.error('api.admin.notifications.error', { latency: Date.now() - start, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
