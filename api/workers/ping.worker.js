import { logger } from '../../services/logger/index.js';

export default function handler(req, res) {
  const ts = new Date().toISOString();
  logger.info('worker.ping.executed', { timestamp: ts });
  return res.status(200).json({ ok: true, timestamp: ts, service: 'worker-ping' });
}
