import { supabaseAdmin } from '../supabase.js';

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
   * Atualiza o estado da assinatura de forma atômica e sincronizada.
   */
  async updateSubscriptionState(userId, { status, plan = 'premium', billingType = 'pix', autoRenew = false, currentPeriodEnd, lastPaymentId, customerId, subscriptionId }) {
    if (!userId) throw new Error('[SubscriptionService] userId é obrigatório.');

    const now = new Date().toISOString();

    // 1. Atualizar Profile
    const profileUpdate = {
      plano: plan,
      assinatura_status: status,
      updated_at: now
    };

    if (currentPeriodEnd) {
      profileUpdate.assinatura_expira_em = currentPeriodEnd;
    }
    if (customerId) {
      profileUpdate.asaas_customer_id = customerId;
    }

    try {
      await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', userId);
    } catch (err) {
      console.warn('[SubscriptionService] Falha ao atualizar profile:', err.message);
    }

    // 2. Atualizar Subscriptions (com fallback de colunas para resiliência DDL)
    const subPayload = {
      user_id: userId,
      status,
      plan,
      provider: 'asaas',
      updated_at: now
    };

    if (lastPaymentId) subPayload.last_payment_id = lastPaymentId;
    if (currentPeriodEnd) subPayload.current_period_end = currentPeriodEnd;
    if (customerId) subPayload.asaas_customer_id = customerId;
    if (subscriptionId) subPayload.asaas_subscription_id = subscriptionId;

    // Colunas V23 opcionais
    const subPayloadV23 = {
      ...subPayload,
      billing_type: billingType,
      auto_renew: autoRenew,
      gateway: 'asaas'
    };

    try {
      const { error } = await supabaseAdmin
        .from('subscriptions')
        .upsert(subPayloadV23, { onConflict: 'user_id' });

      if (error) {
        // Fallback caso a migração v23 ainda não tenha sido rodada no SQL Editor
        await supabaseAdmin
          .from('subscriptions')
          .upsert(subPayload, { onConflict: 'user_id' });
      }
    } catch (subErr) {
      console.warn('[SubscriptionService] Falha ao upsert subscriptions:', subErr.message);
    }

    return { userId, status, plan };
  }
};
