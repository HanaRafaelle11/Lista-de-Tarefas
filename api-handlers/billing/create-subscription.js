import { createSubscription } from '../../domain/billing/index.js';
import { logger } from '../../services/logger/index.js';

export default async function handler(req, res) {
  const start = Date.now();
  const userId = req.body?.userId || req.query?.userId || 'user_demo';
  const planId = req.body?.planId || 'pro';

  try {
    const result = await createSubscription({ userId, planId });
    logger.info('api.billing.createSubscription.success', { userId, latency: Date.now() - start });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('api.billing.createSubscription.error', { userId, latency: Date.now() - start, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
