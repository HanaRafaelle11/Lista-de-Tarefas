import { RevenueAnalyticsService } from '../../services/revenue-analytics-service.js';
import { logger } from '../../services/logger/index.js';

export default async function handler(req, res) {
  const start = Date.now();

  try {
    const revenueData = await RevenueAnalyticsService.getRevenueMetrics();
    logger.info('api.analytics.revenue.success', { latency: Date.now() - start });
    return res.status(200).json(revenueData);
  } catch (err) {
    logger.error('api.analytics.revenue.error', { latency: Date.now() - start, error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
