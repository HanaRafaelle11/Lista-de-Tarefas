import { AccessDecisionEngine } from '../../services/access-decision-engine.js';
import { logger } from '../../services/logger/index.js';

export default async function handler(req, res) {
  const start = Date.now();
  const userId = req.query?.userId || 'user_demo';

  try {
    const result = await AccessDecisionEngine.getAccessResolution(userId);
    logger.info('api.auth.accessCheck.success', { userId, latency: Date.now() - start });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('api.auth.accessCheck.error', { userId, latency: Date.now() - start, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
