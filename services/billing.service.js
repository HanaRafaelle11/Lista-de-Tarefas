import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

export async function createSubscription({ userId, planId, traceId }) {
  logger.info('billing.service.createSubscription', { traceId, userId, planId });
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

export async function checkBillingExpirations({ traceId }) {
  logger.info('billing.service.checkBillingExpirations', { traceId });
  if (!supabaseAdmin) return { expiredCount: 0 };

  const now = new Date().toISOString();
  const { data: expired } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('status', 'active')
    .lt('expires_at', now);

  if (!expired || expired.length === 0) return { expiredCount: 0 };

  const ids = expired.map(s => s.id);
  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'expired', updated_at: now })
    .in('id', ids);

  return { expiredCount: ids.length };
}
