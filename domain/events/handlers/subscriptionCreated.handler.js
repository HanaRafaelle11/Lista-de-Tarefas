import { logger } from '../../../services/logger/logger.js';

export async function handleSubscriptionCreated(payload) {
  logger.info('[DomainHandler] Processando subscription.created', payload);
  // Regras de negócio de domínio para ativação de assinatura PRO
  return { success: true, handled: 'subscription.created' };
}
