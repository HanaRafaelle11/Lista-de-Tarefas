import { supabaseAdmin } from '../supabase.js';
import { DistributedLock } from '../../api/distributed-lock.js';
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

  /**
   * Ativa ou renova o plano Premium do usuário após confirmação de pagamento.
   */
  async processPaymentSuccess({ userId, customerId, paymentId, subscriptionId, billingType = 'pix', value, periodDays = 30 }) {
    if (!userId) throw new Error('[BillingEngine] userId é obrigatório.');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const now = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(now.getDate() + periodDays);

      const isCreditCard = billingType.toLowerCase() === 'credit_card' || billingType.toLowerCase() === 'creditcard';
      const autoRenew = isCreditCard;

      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const currentStatus = currentSub?.status || 'free';
      const nextStatus = BillingStateMachine.transition(currentStatus, 'active');

      const resolvedPlan = PLAN_PREMIUM_NAME;
      const priceVal = PLAN_PREMIUM_MONTHLY_PRICE;

      // TAREFA 5: 1. Processar e atualizar Assinatura PRIMEIRO (SSOT Primário)
      const subPayload = {
        user_id: userId,
        status: nextStatus,
        plan: resolvedPlan,
        price: priceVal,
        amount: Number(value) || priceVal,
        provider: PROVIDER_ASAAS,
        gateway: PROVIDER_ASAAS,
        billing_type: isCreditCard ? 'credit_card' : 'pix',
        auto_renew: autoRenew,
        current_period_end: expiryDate.toISOString(),
        updated_at: now.toISOString()
      };
      if (paymentId) subPayload.last_payment_id = paymentId;
      if (customerId) subPayload.asaas_customer_id = customerId;
      if (subscriptionId) subPayload.asaas_subscription_id = subscriptionId;

      await supabaseAdmin.from('subscriptions').upsert(subPayload, { onConflict: 'user_id' });
      console.log('[BILLING FINAL STATE]', subPayload);

      // TAREFA 5: 2. Atualizar Perfil do Usuário (Derivado Secundário)
      const profileUpdate = {
        plano: resolvedPlan,
        assinatura_status: nextStatus,
        assinatura_inicio: now.toISOString(),
        assinatura_expira_em: expiryDate.toISOString(),
        updated_at: now.toISOString()
      };
      if (customerId) {
        profileUpdate.asaas_customer_id = customerId;
      }
      await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', userId);

      // TAREFA 5: 3. Limpar cache secundário após gravação confirmada
      AccessDecisionEngine.invalidateCache(userId);

      // TAREFA 5: Log de Eventual Consistency & Observabilidade
      await logPaymentEvent({
        userId,
        subscriptionId,
        paymentId,
        customerId,
        event: 'subscription_updated',
        status: 'success',
        payload: { nextStatus, resolvedPlan, autoRenew }
      });

      // Registrar evento de auditoria no histórico do usuário
      try {
        await supabaseAdmin.from('events').insert([{
          user_id: userId,
          event_type: 'payment_approved',
          metadata: { paymentId, customerId, billingType, value: value || priceVal, autoRenew },
          created_at: now.toISOString()
        }]);
      } catch (err) {
        console.error('[BillingEngine DB EXCEPTION insert event_approved]', err);
      }

      return { success: true, userId, status: nextStatus, plan: resolvedPlan };
    });
  },

  /**
   * Registra cobrança vencida ou atrasada no ciclo de faturamento.
   */
  async processPaymentOverdue({ userId, paymentId }) {
    if (!userId) throw new Error('[BillingEngine] userId é obrigatório.');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const now = new Date().toISOString();
      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const currentStatus = currentSub?.status || 'free';
      const nextStatus = BillingStateMachine.transition(currentStatus, 'past_due');

      // Atualiza perfil para free (removendo privilégios)
      await supabaseAdmin.from('profiles').update({
        plano: PLAN_FREE_NAME,
        assinatura_status: nextStatus,
        updated_at: now
      }).eq('id', userId);

      // Atualiza assinatura para past_due com valor zero
      const subUpdate = {
        user_id: userId,
        status: nextStatus,
        plan: PLAN_FREE_NAME,
        price: PLAN_FREE_PRICE,
        amount: PLAN_FREE_PRICE,
        updated_at: now
      };
      if (paymentId) subUpdate.last_payment_id = paymentId;

      await supabaseAdmin.from('subscriptions').upsert(subUpdate, { onConflict: 'user_id' });

      try {
        await supabaseAdmin.from('events').insert([{
          user_id: userId,
          event_type: 'payment_overdue',
          metadata: { paymentId },
          created_at: now
        }]);
      } catch (err) {
        console.error('[BillingEngine DB EXCEPTION insert event_overdue]', err);
      }

      return { success: true, userId, status: nextStatus, plan: PLAN_FREE_NAME };
    });
  },

  /**
   * Cancela ou expira a assinatura do usuário, revertendo para plano Free.
   */
  async processSubscriptionCanceled({ userId, reason = 'canceled' }) {
    if (!userId) throw new Error('[BillingEngine] userId é obrigatório.');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const now = new Date().toISOString();
      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const currentStatus = currentSub?.status || 'free';
      const targetStatus = reason === 'expired' ? 'expired' : 'canceled';
      const nextStatus = BillingStateMachine.transition(currentStatus, targetStatus);

      // Reverte perfil para free
      await supabaseAdmin.from('profiles').update({
        plano: PLAN_FREE_NAME,
        assinatura_status: nextStatus,
        assinatura_inicio: null,
        assinatura_expira_em: null,
        updated_at: now
      }).eq('id', userId);

      // Reverte assinatura para free
      await supabaseAdmin.from('subscriptions').upsert({
        user_id: userId,
        status: nextStatus,
        plan: PLAN_FREE_NAME,
        price: PLAN_FREE_PRICE,
        amount: PLAN_FREE_PRICE,
        auto_renew: false,
        updated_at: now
      }, { onConflict: 'user_id' });

      try {
        await supabaseAdmin.from('events').insert([{
          user_id: userId,
          event_type: `subscription_${reason}`,
          metadata: { reason },
          created_at: now
        }]);
      } catch (err) {
        console.error(`[BillingEngine DB EXCEPTION insert event_${reason}]`, err);
      }

      return { success: true, userId, status: nextStatus, plan: PLAN_FREE_NAME };
    });
  },

  /**
   * Trata estorno (refund) do pagamento da assinatura.
   */
  async processSubscriptionRefunded({ userId }) {
    if (!userId) throw new Error('[BillingEngine] userId é obrigatório.');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const now = new Date().toISOString();
      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const currentStatus = currentSub?.status || 'free';
      const nextStatus = BillingStateMachine.transition(currentStatus, 'refunded');

      // Reverte perfil para free
      await supabaseAdmin.from('profiles').update({
        plano: PLAN_FREE_NAME,
        assinatura_status: nextStatus,
        assinatura_inicio: null,
        assinatura_expira_em: null,
        updated_at: now
      }).eq('id', userId);

      // Reverte assinatura para free
      await supabaseAdmin.from('subscriptions').upsert({
        user_id: userId,
        status: nextStatus,
        plan: PLAN_FREE_NAME,
        price: PLAN_FREE_PRICE,
        amount: PLAN_FREE_PRICE,
        auto_renew: false,
        updated_at: now
      }, { onConflict: 'user_id' });

      try {
        await supabaseAdmin.from('events').insert([{
          user_id: userId,
          event_type: 'subscription_refunded',
          metadata: { reason: 'refunded' },
          created_at: now
        }]);
      } catch (err) {
        console.error('[BillingEngine DB EXCEPTION insert event_refunded]', err);
      }

      return { success: true, userId, status: nextStatus, plan: PLAN_FREE_NAME };
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
    });
  }
};
