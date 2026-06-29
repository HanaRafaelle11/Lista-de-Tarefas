import { processNotificationQueue } from '../../domain/notifications/index.js';
import { logger } from '../../services/logger/index.js';

export default async function handler(req, res) {
  const start = Date.now();
  try {
    const result = await processNotificationQueue();
    logger.info('worker.notifications.success', { latency: Date.now() - start, ...result });
    return res.status(200).json({ ok: true, timestamp: new Date().toISOString(), ...result });
  } catch (err) {
    logger.error('worker.notifications.error', { latency: Date.now() - start, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
