import { supabaseAdmin } from '../supabase.js';
import { DistributedLock } from '../../api/distributed-lock.js';
import { SubscriptionService } from './subscriptionService.js';

export const BillingEngine = {
  /**
   * Ativa ou renova o plano Premium do usuário.
   */
  async processPaymentSuccess({ userId, customerId, paymentId, subscriptionId, billingType = 'pix', value = 14.90, periodDays = 30 }) {
    if (!userId) throw new Error('[BillingEngine] userId é obrigatório para processamento de pagamento.');

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      const now = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(now.getDate() + periodDays);

      const isCreditCard = billingType.toLowerCase() === 'credit_card' || billingType.toLowerCase() === 'creditcard';
      const autoRenew = isCreditCard; // Cartão de crédito renova automaticamente; PIX é cobrança manual por ciclo

      console.log(`[BillingEngine] Ativando Premium para userId=${userId} via ${billingType.toUpperCase()} (autoRenew=${autoRenew})`);

      await SubscriptionService.updateSubscriptionState(userId, {
        status: 'active',
        plan: 'premium',
        billingType: isCreditCard ? 'credit_card' : 'pix',
        autoRenew,
        currentPeriodEnd: expiryDate.toISOString(),
        lastPaymentId: paymentId,
        customerId,
        subscriptionId
      });

      // Registrar evento de auditoria no histórico
      try {
        const { error: eventErr } = await supabaseAdmin.from('events').insert([{
          user_id: userId,
          event_type: 'payment_approved',
          metadata: { paymentId, customerId, billingType, value, autoRenew },
          created_at: now.toISOString()
        }]);
        if (eventErr) console.warn('[BillingEngine DB WARN insert event_approved]', eventErr.message);
      } catch (err) {
        console.error('[BillingEngine DB EXCEPTION insert event_approved]', err);
      }

      return { success: true, userId, status: 'active', plan: 'premium' };
    });
  },

  /**
   * Trata cobrança vencida / sem pagamento no ciclo.
   */
  async processPaymentOverdue({ userId, paymentId }) {
    if (!userId) return;

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      console.log(`[BillingEngine] Registrando cobrança vencida para userId=${userId} (paymentId=${paymentId})`);

      await SubscriptionService.updateSubscriptionState(userId, {
        status: 'past_due',
        plan: 'premium',
        lastPaymentId: paymentId
      });

      try {
        const { error: eventErr } = await supabaseAdmin.from('events').insert([{
          user_id: userId,
          event_type: 'payment_overdue',
          metadata: { paymentId },
          created_at: new Date().toISOString()
        }]);
        if (eventErr) console.warn('[BillingEngine DB WARN insert event_overdue]', eventErr.message);
      } catch (err) {
        console.error('[BillingEngine DB EXCEPTION insert event_overdue]', err);
      }
    });
  },

  /**
   * Cancela ou expira a assinatura do usuário, retornando-o ao plano Free.
   */
  async processSubscriptionCanceled({ userId, reason = 'canceled' }) {
    if (!userId) return;

    return await DistributedLock.withLock('subscription:' + userId, async () => {
      console.log(`[BillingEngine] Desativando assinatura para userId=${userId} (razão=${reason})`);

      await SubscriptionService.updateSubscriptionState(userId, {
        status: reason === 'expired' ? 'expired' : 'canceled',
        plan: 'free',
        autoRenew: false
      });

      try {
        const { error: eventErr } = await supabaseAdmin.from('events').insert([{
          user_id: userId,
          event_type: `subscription_${reason}`,
          metadata: { reason },
          created_at: new Date().toISOString()
        }]);
        if (eventErr) console.warn('[BillingEngine DB WARN insert event_canceled]', eventErr.message);
      } catch (err) {
        console.error('[BillingEngine DB EXCEPTION insert event_canceled]', err);
      }
    });
  }
};
