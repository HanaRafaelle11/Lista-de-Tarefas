import { verifySubscriptionStatus } from '../../domain/billing/index.js';
import { logger } from '../../services/logger/index.js';

export default async function handler(req, res) {
  const start = Date.now();
  const userId = req.query?.userId || 'user_demo';

  try {
    const status = await verifySubscriptionStatus(userId);
    logger.info('api.billing.status.success', { userId, latency: Date.now() - start });
    return res.status(200).json(status);
  } catch (err) {
    logger.error('api.billing.status.error', { userId, latency: Date.now() - start, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
