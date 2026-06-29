import { supabaseAdmin } from '../../services/supabase/index.js';
import { logger } from '../../services/logger/index.js';

export async function createSubscription({ userId, planId, customerData }) {
  logger.info('domain.billing.createSubscription', { userId, planId });
  if (!userId) throw new Error('userId is required');

  if (!supabaseAdmin) {
    return { id: `sub_mock_${Date.now()}`, status: 'active', planId, userId };
  }

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .insert({ user_id: userId, plan: planId || 'pro', status: 'active' })
    .select('*')
    .single();

  if (error && error.code !== '23505') throw error;
  return data || { status: 'active', user_id: userId };
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
