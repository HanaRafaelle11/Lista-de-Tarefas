import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { BillingEventProjector } from '../workers/billing-event-projector.js';

/**
 * Billing Event Gateway (Ledger First Entry Point)
 * 
 * Único ponto de entrada para qualquer alteração no faturamento.
 * Grava o evento imutável no ledger de eventos (billing_events) e dispara
 * a projeção correspondente de forma assíncrona/reativa.
 */
export const BillingEventGateway = {
  /**
   * Emite um evento financeiro de faturamento.
   * 
   * @param {Object} event
   * @param {string} event.type - Tipo do evento (ex: 'subscription_activated', 'subscription_canceled', 'payment_overdue', 'subscription_refunded', 'subscription_expired')
   * @param {string} event.userId - ID do usuário afetado
   * @param {string} [event.providerEventId] - Chave física de idempotência (ex: webhook event ID ou ID de pagamento Asaas)
   * @param {string} [event.paymentId] - ID do pagamento associado
   * @param {string} [event.subscriptionId] - ID da assinatura associada
   * @param {number} [event.value] - Valor monetário da transação
   * @param {string} [event.status] - Status operacional associado
   * @param {Object} [event.metadata] - Informações extras da transação (ex: plano resolvido, datas, autoRenew)
   */
  async emitEvent({ type, userId, providerEventId, paymentId, subscriptionId, value, status, metadata }) {
    if (!userId || !type) {
      throw new Error('[BillingEventGateway] userId e type são obrigatórios.');
    }

    const deterministicEventId = providerEventId || paymentId || `${type}_${userId}_${Date.now()}`;
    const nowIso = new Date().toISOString();

    logger.info('billing.event.gateway.emit', { type, userId, providerEventId: deterministicEventId });

    try {
      if (!supabaseAdmin) {
        logger.warn('[BillingEventGateway] supabaseAdmin não configurado.');
        return null;
      }

      // 1. Persistir o evento no ledger imutável (idempotência física)
      const { data: event, error } = await supabaseAdmin
        .from('billing_events')
        .insert([{
          user_id: userId,
          event_type: type,
          payment_id: paymentId || null,
          subscription_id: subscriptionId || null,
          value: value || 0,
          status: status || null,
          provider_event_id: deterministicEventId,
          metadata: metadata || {},
          created_at: nowIso
        }])
        .select()
        .maybeSingle();

      if (error) {
        // Trata violação de restrição única (idempotência física do ledger)
        if (error.code === '23505') {
          logger.info('billing.event.gateway.deduplicated', { userId, providerEventId: deterministicEventId });
          return { deduplicated: true };
        }
        logger.error('billing.event.gateway.insert_failed', { error: error.message });
        throw error;
      }

      // 2. Acionar a projeção correspondente de forma reativa e imediata
      logger.info('billing.event.gateway.trigger_projector', { eventId: event.id, type });
      await BillingEventProjector.project(event);

      return event;
    } catch (err) {
      logger.error('billing.event.gateway.exception', { error: err.message });
      throw err;
    }
  }
};
