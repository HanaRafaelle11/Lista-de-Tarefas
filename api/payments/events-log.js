import { logger } from '../../services/logger/index.js';

export default async function handler(req, res) {
  const start = Date.now();
  const eventData = req.body || {};

  try {
    logger.info('api.payments.eventsLog', { eventData, latency: Date.now() - start });
    return res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('api.payments.eventsLog.error', { latency: Date.now() - start, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
