import { processPendingNotificationQueue } from '../../services/notification.service.js';
import { checkBillingExpirations } from '../../services/billing.service.js';
import { processGrowthOSEngine } from '../../domain/growth/growthEngine.js';
import { logger } from '../../lib/logger.js';

export default async function handler(req, res) {
  const start = Date.now();
  const traceId = `trc_loop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  logger.info('worker_loop.start', { traceId, timestamp });

  const results = {
    ok: true,
    traceId,
    timestamp,
    summary: {
      notificationsProcessed: 0,
      notificationsFailed: 0,
      subscriptionsExpired: 0,
      growthActionsTriggered: 0
    },
    errors: []
  };

  // Stage 1: Process Notification Queue
  try {
    const notifResult = await processPendingNotificationQueue({ traceId });
    results.summary.notificationsProcessed = notifResult.processed || 0;
    results.summary.notificationsFailed = notifResult.failed || 0;
  } catch (err) {
    logger.error('worker_loop.notifications.error', { traceId, error: err.message });
    results.errors.push({ stage: 'notifications', error: err.message });
  }

  // Stage 2: Process Billing Expirations
  try {
    const billingResult = await checkBillingExpirations({ traceId });
    results.summary.subscriptionsExpired = billingResult.expiredCount || 0;
  } catch (err) {
    logger.error('worker_loop.billing.error', { traceId, error: err.message });
    results.errors.push({ stage: 'billing', error: err.message });
  }

  // Stage 3: Process Growth OS Engine
  try {
    const growthResult = await processGrowthOSEngine({ traceId });
    results.summary.growthActionsTriggered = growthResult.actionsTriggered || 0;
    if (growthResult.error) {
      results.errors.push({ stage: 'growth', error: growthResult.error });
    }
  } catch (err) {
    logger.error('worker_loop.growth.error', { traceId, error: err.message });
    results.errors.push({ stage: 'growth', error: err.message });
  }

  const latency = Date.now() - start;
  results.latencyMs = latency;

  // Always return 200 — partial failures are reported in the response body
  if (results.errors.length > 0) {
    results.ok = false;
    logger.warn('worker_loop.partial_failure', { traceId, latency, errorCount: results.errors.length });
  } else {
    logger.info('worker_loop.finish', { traceId, latency, ...results.summary });
  }

  return res.status(200).json(results);
}
