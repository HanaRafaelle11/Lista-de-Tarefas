import { logger } from '../lib/logger.js';

export async function recordPaymentTransaction({ userId, amount, traceId }) {
  logger.info('payment.service.recordPaymentTransaction', { traceId, userId, amount });
  return { success: true, transactionId: `tx_${Date.now()}` };
}
