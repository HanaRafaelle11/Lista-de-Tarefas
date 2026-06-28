import { supabaseAdmin } from '../supabase.js';
import { BillingEngine } from './engine.js';
import { PLAN_PREMIUM_MONTHLY_PRICE } from './config.js';

export const SubscriptionService = {
  /**
   * Obtém os detalhes completos da assinatura e perfil do usuário.
   */
  async getSubscription(userId) {
    if (!userId) throw new Error('[SubscriptionService] userId é obrigatório.');

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, plano, assinatura_status, assinatura_inicio, assinatura_expira_em, asaas_customer_id')
      .eq('id', userId)
      .maybeSingle();

    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    return { profile, subscription };
  },

  /**
   * Atualiza o estado da assinatura - agora delegando exclusivamente para a BillingEngine.
   */
  async updateSubscriptionState(userId, { status, plan = 'premium', billingType = 'pix', autoRenew = false, currentPeriodEnd, lastPaymentId, customerId, subscriptionId }) {
    if (!userId) throw new Error('[SubscriptionService] userId é obrigatório.');

    const normalizedStatus = String(status).toLowerCase().trim();

    if (normalizedStatus === 'active') {
      return await BillingEngine.processPaymentSuccess({
        userId,
        customerId,
        paymentId: lastPaymentId,
        subscriptionId,
        billingType,
        value: PLAN_PREMIUM_MONTHLY_PRICE
      });
    } else if (normalizedStatus === 'past_due') {
      return await BillingEngine.processPaymentOverdue({
        userId,
        paymentId: lastPaymentId
      });
    } else if (normalizedStatus === 'canceled' || normalizedStatus === 'expired') {
      return await BillingEngine.processSubscriptionCanceled({
        userId,
        reason: normalizedStatus
      });
    } else if (normalizedStatus === 'refunded') {
      return await BillingEngine.processSubscriptionRefunded({
        userId
      });
    } else if (normalizedStatus === 'pending') {
      return await BillingEngine.createPendingSubscription(userId, {
        providerId: subscriptionId,
        customerId,
        billingType
      });
    } else {
      // Fallback para correções genéricas de conciliação
      await BillingEngine.handleReconciliationFix(userId, {
        targetPlan: plan,
        targetStatus: normalizedStatus,
        customerId,
        expiresAt: currentPeriodEnd
      });
      return { userId, status: normalizedStatus, plan };
    }
  }
};
