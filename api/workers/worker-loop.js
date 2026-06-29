import { processPendingNotificationQueue } from '../../services/notification.service.js';
import { checkBillingExpirations } from '../../services/billing.service.js';
import { processGrowthOSEngine } from '../../domain/growth/growthEngine.js';
import { logger } from '../../lib/logger.js';

export default async function handler(req, res) {
  const start = Date.now();
  const traceId = `trc_loop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  logger.info('worker_loop.start', { traceId, timestamp });

  try {
    // 1. Processar Fila de Notificações
    const notifResult = await processPendingNotificationQueue({ traceId });

    // 2. Processar Expirações de Faturamento
    const billingResult = await checkBillingExpirations({ traceId });

    // 3. Processar Inteligência e Automações Growth OS
    const growthResult = await processGrowthOSEngine({ traceId });

    const latency = Date.now() - start;
    logger.info('worker_loop.finish', {
      traceId,
      latency,
      processedNotifications: notifResult.processed,
      expiredSubscriptions: billingResult.expiredCount,
      growthActionsTriggered: growthResult.actionsTriggered || 0
    });

    return res.status(200).json({
      ok: true,
      traceId,
      timestamp,
      latencyMs: latency,
      summary: {
        notificationsProcessed: notifResult.processed,
        subscriptionsExpired: billingResult.expiredCount,
        growthActionsTriggered: growthResult.actionsTriggered || 0
      }
    });

  } catch (err) {
    const latency = Date.now() - start;
    logger.error('worker_loop.error', { traceId, latency, error: err.message });
    return res.status(500).json({
      ok: false,
      traceId,
      error: err.message
    });
  }
}
