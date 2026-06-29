import { calculateRevenue } from '../../domain/analytics/index.js';
import { logger } from '../../services/logger/index.js';

export default async function handler(req, res) {
  const start = Date.now();

  try {
    const revenue = await calculateRevenue();
    logger.info('api.admin.dashboard.success', { latency: Date.now() - start });
    return res.status(200).json({
      status: 'healthy',
      system: 'online',
      metrics: revenue,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('api.admin.dashboard.error', { latency: Date.now() - start, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
