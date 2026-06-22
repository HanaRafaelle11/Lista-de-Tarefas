import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Revenue Integrity Service
 * Computes business-critical metrics (MRR, Churn, Leakage, Cohorts) to maintain financial sanity.
 */
export const RevenueIntegrityService = {
  /**
   * Calculates Monthly Recurring Revenue (MRR) from active subscriptions.
   * 
   * @returns {Promise<number>} MRR value
   */
  async calculateMRR() {
    try {
      const { data: activeSubs, error } = await supabaseAdmin
        .from('subscriptions')
        .select('price')
        .eq('status', 'active');

      if (error) {
        console.error('[RevenueIntegrity] Erro ao calcular MRR:', error.message);
        return 0;
      }

      const mrr = activeSubs.reduce((sum, sub) => sum + (Number(sub.price) || 0), 0);
      return Math.round(mrr * 100) / 100;
    } catch (err) {
      console.error('[RevenueIntegrity] Erro crítico no calculateMRR:', err);
      return 0;
    }
  },

  /**
   * Computes cohort-based/rolling churn rate of subscriptions in the last 30 days.
   * Churn Rate = Lost Subscriptions / (Active Subscriptions + Lost Subscriptions)
   * 
   * @returns {Promise<number>} Churn rate as a percentage (e.g. 5.25)
   */
  async calculateChurnRate() {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);

      // Active subscriptions
      const { data: activeSubs, error: err1 } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('status', 'active');

      // Subscriptions canceled or expired in last 30 days
      const { data: lostSubs, error: err2 } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .in('status', ['canceled', 'expired'])
        .gte('updated_at', thirtyDaysAgo.toISOString());

      if (err1 || err2) {
        console.error('[RevenueIntegrity] Erro ao obter dados de churn:', err1?.message || err2?.message);
        return 0;
      }

      const activeCount = activeSubs?.length || 0;
      const lostCount = lostSubs?.length || 0;

      const totalCount = activeCount + lostCount;
      if (totalCount === 0) return 0.0;

      return Math.round((lostCount / totalCount) * 10000) / 100;
    } catch (err) {
      console.error('[RevenueIntegrity] Erro crítico no calculateChurnRate:', err);
      return 0;
    }
  },

  /**
   * Identifies users that have active premium access in their profile
   * but DO NOT have an active subscription record (Revenue Leakage).
   * 
   * @returns {Promise<Array>} List of leakage details
   */
  async detectRevenueLeakage() {
    try {
      const { data: profiles, error: err1 } = await supabaseAdmin
        .from('profiles')
        .select('id, plano, nickname')
        .eq('plano', 'premium');

      if (err1) {
        console.error('[RevenueIntegrity] Erro ao carregar perfis premium:', err1.message);
        return [];
      }

      const leakage = [];

      for (const profile of profiles) {
        const { data: sub, error: err2 } = await supabaseAdmin
          .from('subscriptions')
          .select('status')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (err2) continue;

        if (!sub || sub.status !== 'active') {
          leakage.push({
            user_id: profile.id,
            nickname: profile.nickname || 'Usuário Premium',
            subscription_status: sub?.status || 'none'
          });
        }
      }

      return leakage;
    } catch (err) {
      console.error('[RevenueIntegrity] Erro crítico no detectRevenueLeakage:', err);
      return [];
    }
  },

  /**
   * Groups subscription cohort retention by month of signup.
   * 
   * @returns {Promise<Array>} Cohorts summary list
   */
  async getCohortTracking() {
    try {
      const { data: subs, error } = await supabaseAdmin
        .from('subscriptions')
        .select('created_at, status');

      if (error) {
        console.error('[RevenueIntegrity] Erro ao obter dados de coortes:', error.message);
        return [];
      }

      const cohorts = {};

      for (const sub of subs) {
        if (!sub.created_at) continue;
        const createdDate = new Date(sub.created_at);
        const cohortMonth = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;

        if (!cohorts[cohortMonth]) {
          cohorts[cohortMonth] = {
            cohort: cohortMonth,
            registered: 0,
            retained: 0,
            churned: 0
          };
        }

        cohorts[cohortMonth].registered++;
        if (sub.status === 'active') {
          cohorts[cohortMonth].retained++;
        } else {
          cohorts[cohortMonth].churned++;
        }
      }

      return Object.values(cohorts);
    } catch (err) {
      console.error('[RevenueIntegrity] Erro crítico no getCohortTracking:', err);
      return [];
    }
  }
};
