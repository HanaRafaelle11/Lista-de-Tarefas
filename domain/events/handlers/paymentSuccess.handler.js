import { logger } from '../../../services/logger/logger.js';

export async function handlePaymentSuccess(payload) {
  logger.info('[DomainHandler] Processando payment.success', payload);
  // Regras de negócio de domínio para registro contábil de pagamento recebido
  return { success: true, handled: 'payment.success' };
}
