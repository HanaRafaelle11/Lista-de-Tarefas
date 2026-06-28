/**
 * Billing Service — Cérebro Regras de Negócio e Consolidação
 * 
 * Executa merge de dados, fallback de usuários e regras de negócio com zero HTTP 500.
 */
import { billingRepository } from './billing.repository.js';
import { mapBillingEvents, mapBillingLedgers } from './billing.mapper.js';

export const billingService = {
  async getBillingTimeline(userIdOrSearch) {
    if (!userIdOrSearch) {
      return {
        userId: null,
        user: null,
        subscription: null,
        events: [],
        ledger: [],
        history: [],
        gateway: 'asaas',
        provider: 'asaas',
        status: 'free',
        amount: 0,
        value: 0
      };
    }

    // 1. Resolver usuário via repositório
    const resolvedUser = await billingRepository.resolveUser(userIdOrSearch);
    const targetUserId = resolvedUser ? resolvedUser.id : userIdOrSearch;

    // 2. Executar consultas paralelas isoladas
    const [rawEvents, rawLedger, rawSub] = await Promise.all([
      billingRepository.getBillingEvents(targetUserId),
      billingRepository.getLedger(targetUserId),
      billingRepository.getSubscription(targetUserId)
    ]);

    // 3. Mapear DTOs
    const events = mapBillingEvents(rawEvents);
    const ledger = mapBillingLedgers(rawLedger);
    const history = [...events, ...ledger].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      userId: targetUserId,
      user: resolvedUser,
      subscription: rawSub,
      events,
      ledger,
      history,
      gateway: rawSub?.gateway || rawSub?.provider || 'asaas',
      provider: rawSub?.provider || rawSub?.gateway || 'asaas',
      status: rawSub?.status || 'free',
      amount: Number(rawSub?.amount ?? rawSub?.price ?? 0),
      value: Number(rawSub?.amount ?? rawSub?.price ?? 0)
    };
  }
};
