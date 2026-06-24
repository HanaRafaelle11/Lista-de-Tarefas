import { supabaseAdmin } from '../lib/supabase.js';
import { DistributedLock } from './distributed-lock.js';
import { BillingTracer, BillingLogger } from './billing-tracer.js';

// Máquina de Estados de Assinatura Inline para evitar erros de importação na Vercel
const SubscriptionStateMachine = {
  transitions: {
    null: ['active', 'past_due', 'free'],
    'free': ['active', 'past_due'],
    'active': ['past_due', 'canceled', 'unpaid'],
    'past_due': ['active', 'unpaid', 'canceled'],
    'unpaid': ['active', 'canceled'],
    'canceled': ['active']
  },
  transition(currentStatus, nextStatus) {
    const available = this.transitions[currentStatus] || this.transitions[null];
    if (available.includes(nextStatus)) {
      return nextStatus;
    }
    console.warn('[StateMachine] Transição inválida. Forçando próximo estado.');
    return nextStatus;
  }
};

const sendPushNotification = async (userId, title, body) => {
  console.log('[Billing Engine Push] Notificação simulada para ' + userId);
};

async function insertEvent(userId, eventType, metadata = {}) {
  const event = {
    user_id: userId,
    event_type: eventType,
    metadata
  };
  try {
    const { error } = await supabaseAdmin.from('events').insert([event]);
    if (error) console.error(error);
  } catch (err) {
    console.error(err);
  }
}

export const BillingEngine = {
  async setUserPremium(userId, customerId, expiresAt, paymentId = null) {
    if (!userId) throw new Error('[BillingEngine.setUserPremium] userId é obrigatório');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const now = new Date();
      const defaultExpiry = new Date();
      defaultExpiry.setDate(now.getDate() + 30);
      const expirationDate = expiresAt ? new Date(expiresAt) : defaultExpiry;

      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const currentStatus = currentSub?.status || null;
      const nextStatus = SubscriptionStateMachine.transition(currentStatus, 'active');

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({
          plano: 'premium',
          assinatura_status: nextStatus,
          assinatura_inicio: now.toISOString(),
          assinatura_expira_em: expirationDate.toISOString(),
          mercadopago_customer_id: customerId || null,
          updated_at: now.toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id: userId,
          status: nextStatus,
          plan: 'premium',
          price: 14.90,
          current_period_start: now.toISOString(),
          current_period_end: expirationDate.toISOString(),
          last_payment_id: paymentId || null,
          provider: 'mercado_pago',
          updated_at: now.toISOString()
        }, { onConflict: 'user_id' });

      return data;
    });
  },

  async setUserFree(userId, targetStatus = 'canceled') {
    if (!userId) throw new Error('[BillingEngine.setUserFree] userId é obrigatório');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const normalizedTarget = targetStatus.toLowerCase();
      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const currentStatus = currentSub?.status || null;
      const nextStatus = SubscriptionStateMachine.transition(currentStatus, normalizedTarget);

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({
          plano: 'free',
          assinatura_status: nextStatus,
          assinatura_inicio: null,
          assinatura_expira_em: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id: userId,
          status: nextStatus,
          plan: 'premium',
          price: 14.90,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      return data;
    });
  },

  async handlePaymentApproved(userId, customerId, paymentId, paymentData = {}) {
    if (!userId) throw new Error('[BillingEngine.handlePaymentApproved] userId é obrigatório');
    if (!paymentId) throw new Error('[BillingEngine.handlePaymentApproved] paymentId é obrigatório');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const { data: currentProfile } = await supabaseAdmin
        .from('profiles')
        .select('plano, assinatura_status')
        .eq('id', userId)
        .maybeSingle();

      if (currentProfile?.plano === 'premium' && currentProfile?.assinatura_status === 'active') {
        return { success: true, duplicated: false, alreadyPremium: true };
      }

      const paymentStr = String(paymentId);
      await insertEvent(userId, 'payment_received', { payment_id: paymentStr, status: 'approved' });

      try {
        const { data: existingEvent } = await supabaseAdmin
          .from('billing_events')
          .select('id, status')
          .eq('metadata->>payment_id', paymentStr)
          .maybeSingle();

        if (existingEvent) {
          return { success: true, duplicated: true };
        }

        await supabaseAdmin
          .from('billing_events')
          .insert([{
            user_id: userId,
            type: 'payment_success',
            status: 'approved',
            amount: paymentData.transaction_amount || 14.90,
            currency: 'BRL',
            provider: 'mercadopago',
            metadata: {
              payment_id: paymentStr,
              date_approved: paymentData.date_approved || new Date().toISOString()
            },
            created_at: new Date().toISOString()
          }]);

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('assinatura_status')
          .eq('id', userId)
          .maybeSingle();

        const wasCanceled = profile?.assinatura_status === 'canceled';
        let expiresAt = paymentData.date_of_expiration || null;

        if (!expiresAt) {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          expiresAt = d.toISOString();
        }

        const updatedProfile = await this.setUserPremium(userId, customerId, expiresAt, paymentStr);

        if (wasCanceled) {
          await this.handleUserReactivated(userId, paymentStr);
        } else {
          await sendPushNotification(userId, "Pagamento confirmado", "Sua assinatura foi confirmada.");
        }

        return { success: true, duplicated: false, profile: updatedProfile };
      } catch (err) {
        throw err;
      }
    });
  },

  async handlePaymentCanceled(userId) {
    if (!userId) throw new Error('[BillingEngine.handlePaymentCanceled] userId é obrigatório');
    return await DistributedLock.withLock('subscription:' + userId, async () => {
      await insertEvent(userId, 'payment_failed', { reason: 'payment_canceled' });
      const updatedProfile = await this.setUserFree(userId, 'canceled');
      return { success: true, profile: updatedProfile };
    });
  },

  async handlePaymentPastDue(userId) {
    if (!userId) throw new Error('[BillingEngine.handlePaymentPastDue] userId é obrigatório');
    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const currentStatus = currentSub?.status || null;
      const nextStatus = SubscriptionStateMachine.transition(currentStatus, 'past_due');

      await insertEvent(userId, 'payment_failed', { reason: 'past_due' });

      const { data } = await supabaseAdmin
        .from('profiles')
        .update({
          plano: 'free',
          assinatura_status: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id: userId,
          status: nextStatus,
          plan: 'premium',
          price: 14.90,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      return { success: true, profile: data };
    });
  },

  async handleReconciliationFix(userId, targetPlan, targetStatus, customerId, expiresAt, reason) {
    if (!userId) throw new Error('[BillingEngine.handleReconciliationFix] userId é obrigatório');
    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const normalizedStatus = targetStatus.toLowerCase();
      let data;
      if (targetPlan === 'premium' && normalizedStatus === 'active') {
        data = await this.setUserPremium(userId, customerId, expiresAt);
      } else {
        const { data: updated } = await supabaseAdmin
          .from('profiles')
          .update({
            plano: targetPlan,
            assinatura_status: normalizedStatus,
            assinatura_expira_em: expiresAt ? new Date(expiresAt).toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single();
        data = updated;
      }
      return data;
    });
  },

  async handleChurnRiskDetected(userId, riskLevel, churnScore) {
    return { riskLevel, churnScore, retentionAction: 'none' };
  },

  async handleUserReactivated(userId, paymentId) {
    await insertEvent(userId, 'user_reactivated', { payment_id: paymentId });
  }
};