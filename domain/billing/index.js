import { supabaseAdmin } from '../../services/supabase/index.js';
import { logger } from '../../services/logger/index.js';

export async function createSubscription({ userId, planId, customerData }) {
  logger.info('domain.billing.createSubscription', { userId, planId });
  if (!userId) throw new Error('userId is required');

  if (!supabaseAdmin) {
    return { id: `sub_mock_${Date.now()}`, status: 'pending', planId, userId };
  }

  // SECURITY FIX: Never create a subscription with status 'active' directly.
  // Active status must only be set by BillingEngine.processPaymentSuccess()
  // after a confirmed payment from the gateway webhook.
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      plan: planId || 'premium',
      status: 'pending',
      provider: 'asaas',
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error && error.code !== '23505') throw error;
  return data || { status: 'pending', user_id: userId };
}

export async function verifySubscriptionStatus(userId) {
  logger.info('domain.billing.verifySubscriptionStatus', { userId });
  if (!userId) return { hasAccess: false, plan: 'free' };

  if (!supabaseAdmin) return { hasAccess: true, plan: 'pro' };

  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('status, plan')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  return { hasAccess: !!data, plan: data?.plan || 'free' };
}

export async function processPayment(paymentData) {
  logger.info('domain.billing.processPayment', { paymentData });
  return { success: true, transactionId: `tx_${Date.now()}` };
}
