import { supabaseAdmin } from '../supabase.js';
import { DistributedLock } from '../../services/distributed-lock.js';
import { BillingStateMachine } from './state-machine.js';
import { AccessDecisionEngine } from '../../services/access-decision-engine.js';
import { logPaymentEvent } from '../payment-logger.js';
import {
  PLAN_PREMIUM_MONTHLY_PRICE,
  PLAN_FREE_PRICE,
  PLAN_PREMIUM_NAME,
  PLAN_FREE_NAME,
  PROVIDER_ASAAS
} from './config.js';
import { idempotencyStore } from '../../server/modules/billing/idempotency.store.js';
import { EntitlementsService } from '../../services/entitlements.service.js';
import { BillingEventGateway } from '../../services/billing-event-gateway.js';

export const BillingEngine = {
  /**
   * Inicializa uma assinatura pendente no checkout.
   */
  async createPendingSubscription(userId, { providerId, customerId, billingType }) {
    if (!userId) throw new Error('[BillingEngine] userId é obrigatório.');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const now = new Date().toISOString();
      const nextStatus = BillingStateMachine.transition(null, 'pending');
      const priceVal = PLAN_PREMIUM_MONTHLY_PRICE;

      AccessDecisionEngine.invalidateCache(userId);

      // Atualiza o perfil para assinatura pendente (plano permanece free)
      await supabaseAdmin.from('profiles').update({
        assinatura_status: nextStatus,
        updated_at: now
      }).eq('id', userId);

      // Cria/atualiza o registro da assinatura como pendente
      const { data, error } = await supabaseAdmin.from('subscriptions').upsert({
        user_id: userId,
        asaas_subscription_id: providerId || null,
        status: nextStatus,
        plan: PLAN_PREMIUM_NAME,
        price: priceVal,
        amount: priceVal,
        provider: PROVIDER_ASAAS,
        gateway: PROVIDER_ASAAS,
        billing_type: billingType,
        auto_renew: billingType === 'credit_card',
        updated_at: now
      }, { onConflict: 'user_id' });

      if (error) throw error;
      return data;
    });
  },

  async processPaymentSuccess({ userId, customerId, paymentId, subscriptionId, billingType = 'pix', value, periodDays = 30 }) {
    if (!userId) throw new Error('[BillingEngine] userId é obrigatório.');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();

      const now = new Date();
      let baseDate = now;
      if (currentSub?.status === 'active' && currentSub.current_period_end) {
        const existingEnd = new Date(currentSub.current_period_end);
        if (existingEnd > now) {
          baseDate = existingEnd;
        }
      }

      const expiryDate = new Date(baseDate);
      expiryDate.setDate(baseDate.getDate() + periodDays);

      const isCreditCard = billingType.toLowerCase() === 'credit_card' || billingType.toLowerCase() === 'creditcard';
      const autoRenew = isCreditCard;
      const resolvedPlan = PLAN_PREMIUM_NAME;
      const priceVal = PLAN_PREMIUM_MONTHLY_PRICE;

      console.log('[BillingEngine] Emitting subscription_activated event for user:', userId);

      if (!expiryDate || isNaN(expiryDate.getTime())) {
        throw new Error('[BillingEngine] expiryDate inválida para ativação.');
      }

      const metadata = {
        plan: resolvedPlan,
        current_period_end: expiryDate.toISOString(),
        auto_renew: autoRenew,
        billing_type: isCreditCard ? 'credit_card' : 'pix',
        asaas_customer_id: customerId
      };

      const event = await BillingEventGateway.emitEvent({
        type: 'subscription_activated',
        userId,
        providerEventId: paymentId || `evt_act_${userId}_${now.getTime()}`,
        paymentId,
        subscriptionId,
        value: value || priceVal,
        status: 'active',
        metadata
      });

      return { success: true, userId, status: 'active', plan: resolvedPlan, event };
    });
  },

  async processPaymentOverdue({ userId, paymentId }) {
    if (!userId) throw new Error('[BillingEngine] userId é obrigatório.');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const now = new Date();
      const event = await BillingEventGateway.emitEvent({
        type: 'payment_overdue',
        userId,
        providerEventId: paymentId || `evt_overdue_${userId}_${now.getTime()}`,
        paymentId,
        status: 'past_due'
      });

      return { success: true, userId, status: 'past_due', plan: PLAN_FREE_NAME, event };
    });
  },

  async processSubscriptionCanceled({ userId, reason = 'canceled' }) {
    if (!userId) throw new Error('[BillingEngine] userId é obrigatório.');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const now = new Date();
      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();

      const currentStatus = currentSub?.status || 'free';
      const targetStatus = reason === 'expired' ? 'expired' : 'canceled';
      const nextStatus = BillingStateMachine.transition(currentStatus, targetStatus);

      const periodEnd = currentSub?.current_period_end ? new Date(currentSub.current_period_end) : null;
      const stillHasPaidTime = periodEnd && periodEnd > now;

      const event = await BillingEventGateway.emitEvent({
        type: 'subscription_canceled',
        userId,
        providerEventId: `evt_cancel_${userId}_${now.getTime()}`,
        status: nextStatus,
        metadata: {
          target_status: nextStatus,
          still_has_paid_time: stillHasPaidTime,
          current_period_end: periodEnd?.toISOString() || null,
          reason
        }
      });

      return { 
        success: true, 
        userId, 
        status: nextStatus, 
        plan: stillHasPaidTime ? PLAN_PREMIUM_NAME : PLAN_FREE_NAME, 
        accessUntil: stillHasPaidTime ? periodEnd.toISOString() : null,
        event 
      };
    });
  },

  /**
   * Trata estorno (refund) do pagamento da assinatura.
   */
  async processSubscriptionRefunded({ userId }) {
    if (!userId) throw new Error('[BillingEngine] userId é obrigatório.');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const now = new Date();
      const event = await BillingEventGateway.emitEvent({
        type: 'subscription_refunded',
        userId,
        providerEventId: `evt_refund_${userId}_${now.getTime()}`,
        status: 'refunded'
      });

      return { success: true, userId, status: 'refunded', plan: PLAN_FREE_NAME, event };
    });
  },

  /**
   * Atualiza metadados da assinatura de forma encapsulada.
   */
  async updateSubscriptionMetadata(userId, metadata) {
    if (!userId) throw new Error('[BillingEngine] userId é obrigatório.');

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('metadata')
      .eq('user_id', userId)
      .maybeSingle();

    const currentMeta = sub?.metadata || {};
    const newMeta = { ...currentMeta, ...metadata };

    await supabaseAdmin
      .from('subscriptions')
      .update({ metadata: newMeta, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  },

  /**
   * Realiza correção forçada de conciliação ativa pelo Anti-drift reconciler.
   */
  async handleReconciliationFix(userId, { targetPlan, targetStatus, customerId, expiresAt }) {
    if (!userId) throw new Error('[BillingEngine] userId é obrigatório.');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const now = new Date().toISOString();
      const resolvedPlan = targetPlan === 'premium' ? PLAN_PREMIUM_NAME : PLAN_FREE_NAME;
      const priceVal = resolvedPlan === 'premium' ? PLAN_PREMIUM_MONTHLY_PRICE : PLAN_FREE_PRICE;

      await supabaseAdmin.from('profiles').update({
        plano: resolvedPlan,
        assinatura_status: targetStatus,
        assinatura_expira_em: expiresAt || null,
        updated_at: now
      }).eq('id', userId);

      await supabaseAdmin.from('subscriptions').upsert({
        user_id: userId,
        status: targetStatus,
        plan: resolvedPlan,
        price: priceVal,
        amount: priceVal,
        current_period_end: expiresAt || null,
        asaas_customer_id: customerId || undefined,
        updated_at: now
      }, { onConflict: 'user_id' });

      // Sincronizar Entitlement
      if (targetStatus === 'active' && expiresAt) {
        await EntitlementsService.grantEntitlement(userId, 'pro_features', expiresAt);
      } else {
        await EntitlementsService.revokeEntitlement(userId, 'pro_features', targetStatus || 'expired');
      }
    });
  }
};
