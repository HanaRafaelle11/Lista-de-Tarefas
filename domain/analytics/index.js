import { supabaseAdmin } from '../../services/supabase/index.js';
import { logger } from '../../services/logger/index.js';

export async function calculateRevenue() {
  logger.info('domain.analytics.calculateRevenue');
  if (!supabaseAdmin) return { totalRevenue: 15000, activeMRR: 3500, count: 42 };

  const { data } = await supabaseAdmin.from('payment_events').select('amount');
  const total = (data || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  return { totalRevenue: total, activeMRR: total * 0.3, count: (data || []).length };
}

export async function getUserTimeline(userId) {
  logger.info('domain.analytics.getUserTimeline', { userId });
  if (!userId) return { timeline: [] };

  if (!supabaseAdmin) return { timeline: [{ event: 'signup', ts: new Date().toISOString() }] };

  const { data } = await supabaseAdmin
    .from('payment_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return { timeline: data || [] };
}
