import { supabaseAdmin } from '../lib/supabase.js';
import { BillingAdapter } from '../lib/billing/billingAdapter.js';

/**
 * Revenue Analytics Service
 * 
 * Responsável por consolidar métricas financeiras e de churn direto do Supabase,
 * consultando views analíticas e tabelas de assinatura com a camada de adaptação unificada.
 */
export const RevenueAnalyticsService = {
  /**
   * Consolida todas as métricas do painel administrativo.
   */
  async getRevenueMetrics() {
    console.log('[RevenueAnalyticsService] Iniciando consolidação de métricas via BillingAdapter...');
    
    // 1. Executar todas as consultas em paralelo para máxima performance
    const [
      mrrRes,
      churnRes,
      arpuRes,
      cohortRes,
      subsRes,
      profilesRes
    ] = await Promise.all([
      supabaseAdmin.from('vw_mrr_metrics').select('*').order('date', { ascending: true }),
      supabaseAdmin.from('vw_churn_metrics').select('*').order('month', { ascending: true }),
      supabaseAdmin.from('vw_arpu_metrics').select('*').order('date', { ascending: true }),
      supabaseAdmin.from('vw_cohort_retention').select('*'),
      supabaseAdmin.from('subscriptions').select('*'),
      supabaseAdmin.from('profiles').select('id, name, nickname')
    ]);

    if (mrrRes.error) console.warn('[RevenueAnalyticsService WARN mrrRes]', mrrRes.error.message);
    if (churnRes.error) console.warn('[RevenueAnalyticsService WARN churnRes]', churnRes.error.message);
    if (arpuRes.error) console.warn('[RevenueAnalyticsService WARN arpuRes]', arpuRes.error.message);
    if (cohortRes.error) console.warn('[RevenueAnalyticsService WARN cohortRes]', cohortRes.error.message);
    if (subsRes.error) console.error('[RevenueAnalyticsService ERROR subsRes]', subsRes.error.message);
    if (profilesRes.error) console.error('[RevenueAnalyticsService ERROR profilesRes]', profilesRes.error.message);

    const mrrTimeline = mrrRes.data || [];
    const churnRows = churnRes.data || [];
    const arpuTimeline = arpuRes.data || [];
    const cohortRows = cohortRes.data || [];
    const rawSubscriptions = subsRes.data || [];
    const profiles = profilesRes.data || [];

    const subscriptions = rawSubscriptions.map(s => BillingAdapter.normalizeSubscription(s));

    const dailyEvents = {};
    subscriptions.forEach(s => {
      const createdDate = (s.createdAt || new Date().toISOString()).split('T')[0];
      if (!dailyEvents[createdDate]) dailyEvents[createdDate] = { upgrades: 0, churns: 0 };
      dailyEvents[createdDate].upgrades++;

      if (s.status === 'canceled' && s.updatedAt) {
        const canceledDate = (s.updatedAt || new Date().toISOString()).split('T')[0];
        if (!dailyEvents[canceledDate]) dailyEvents[canceledDate] = { upgrades: 0, churns: 0 };
        dailyEvents[canceledDate].churns++;
      }
    });

    const timeline = mrrTimeline.map(row => {
      const events = dailyEvents[row.date] || { upgrades: 0, churns: 0 };
      return {
        date: row.date,
        mrr: Math.round(Number(row.mrr || 0) * 100) / 100,
        upgrades: events.upgrades,
        churns: events.churns,
        reactivations: 0
      };
    });

    const latestMrr = mrrTimeline[mrrTimeline.length - 1] || { mrr: 0, arr: 0 };
    const latestArpu = arpuTimeline[arpuTimeline.length - 1] || { arpu: 0 };
    const latestChurn = churnRows[churnRows.length - 1] || { churn_rate: 0.0, churned_users: 0 };

    const activeSubscribers = subscriptions.filter(s => s.status === 'active' && s.plan !== 'free').length;

    const kpis = {
      mrr: Math.round(Number(latestMrr.mrr || 0) * 100) / 100,
      arr: Math.round(Number(latestMrr.arr || 0) * 100) / 100,
      arpu: Math.round(Number(latestArpu.arpu || 0) * 100) / 100,
      churnRate: Math.round(Number(latestChurn.churn_rate || 0) * 10) / 10,
      nrr: 100.0,
      activeSubscribers,
      reactivatedCount: 0
    };

    let lowRiskCount = 0;
    let mediumRiskCount = 0;
    let highRiskCount = 0;

    subscriptions.forEach(s => {
      if (s.status === 'canceled') highRiskCount++;
      else if (s.status === 'past_due') mediumRiskCount++;
      else lowRiskCount++;
    });

    const period0 = cohortRows.filter(r => r.period === 0);
    const period1 = cohortRows.filter(r => r.period === 1);
    const period3 = cohortRows.filter(r => r.period === 3 || r.period === 2);

    const avgRetention0 = period0.length > 0 ? period0.reduce((acc, r) => acc + Number(r.retention_rate), 0) / period0.length : 100;
    const avgRetention1 = period1.length > 0 ? period1.reduce((acc, r) => acc + Number(r.retention_rate), 0) / period1.length : 100;
    const avgRetention3 = period3.length > 0 ? period3.reduce((acc, r) => acc + Number(r.retention_rate), 0) / period3.length : 100;

    const cohort7d = Math.round((100 - avgRetention0) * 10) / 10;
    const cohort30d = Math.round((100 - avgRetention1) * 10) / 10;
    const cohort90d = Math.round((100 - avgRetention3) * 10) / 10;

    const churn = {
      overallRate: kpis.churnRate,
      cohorts: {
        '7d': cohort7d,
        '30d': cohort30d,
        '90d': cohort90d
      },
      riskCounts: {
        low: lowRiskCount,
        medium: mediumRiskCount,
        high: highRiskCount
      }
    };

    let freeCount = 0;
    let activeCount = 0;
    let canceledCount = 0;
    let pastDueCount = 0;

    subscriptions.forEach(s => {
      if (s.plan === 'free') {
        freeCount++;
      } else {
        if (s.status === 'active') activeCount++;
        else if (s.status === 'canceled') canceledCount++;
        else if (s.status === 'past_due') pastDueCount++;
      }
    });

    const subscriptionBreakdown = {
      free: freeCount,
      active: activeCount,
      canceled: canceledCount,
      pastDue: pastDueCount
    };

    const profileMap = new Map();
    profiles.forEach(p => {
      profileMap.set(p.id, p);
    });

    const customerHealthList = subscriptions
      .filter(s => s.plan === 'premium')
      .map(s => {
        const p = profileMap.get(s.userId);
        
        let riskLevel = 'low';
        let churnScore = 15;
        if (s.status === 'canceled') {
          riskLevel = 'high';
          churnScore = 90;
        } else if (s.status === 'past_due') {
          riskLevel = 'medium';
          churnScore = 50;
        }

        return {
          id: s.userId,
          name: p?.name || p?.nickname || 'Usuário',
          plano: s.plan,
          churnScore,
          riskLevel,
          status: s.status.toUpperCase(),
          lastActiveAt: s.updatedAt
        };
      });

    customerHealthList.sort((a, b) => b.churnScore - a.churnScore);

    const alerts = [];
    const mrr7DaysAgo = timeline[timeline.length - 8]?.mrr || 0;
    if (kpis.mrr < mrr7DaysAgo) {
      alerts.push({
        id: 'mrr_drop',
        type: 'danger',
        title: 'Queda de MRR Detectada',
        message: `O MRR atual de R$ ${kpis.mrr.toFixed(2)} é inferior ao MRR de 7 dias atrás (R$ ${mrr7DaysAgo.toFixed(2)}).`
      });
    }

    if (kpis.churnRate > 10) {
      alerts.push({
        id: 'high_churn',
        type: 'warning',
        title: 'Taxa de Churn Elevada',
        message: `A taxa de Churn está em ${kpis.churnRate.toFixed(1)}% nos últimos 30 dias, superando a meta saudável de 10%.`
      });
    }

    return {
      kpis,
      timeline,
      churn,
      subscriptionBreakdown,
      customerHealth: customerHealthList,
      alerts,
      cohortsHeatmap: cohortRows
    };
  },

  /**
   * Consolida a timeline completa de um usuário específico a partir de suas assinaturas.
   */
  async getUserTimeline(targetUserId) {
    if (!targetUserId) throw new Error('[RevenueAnalyticsService] targetUserId é obrigatório');

    console.log(`[RevenueAnalyticsService] Gerando timeline detalhada para o usuário ${targetUserId}...`);

    const [profileRes, subRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, name, nickname, profession').eq('id', targetUserId).maybeSingle(),
      supabaseAdmin.from('subscriptions').select('*').eq('user_id', targetUserId).maybeSingle()
    ]);

    if (profileRes.error) console.error('[RevenueAnalyticsService ERROR profileRes]', profileRes.error.message);
    if (subRes.error) console.error('[RevenueAnalyticsService ERROR subRes]', subRes.error.message);

    const profile = profileRes.data;
    const sub = subRes.data ? BillingAdapter.normalizeSubscription(subRes.data) : null;

    const timelineItems = [];

    if (profile) {
      timelineItems.push({
        id: `signup_${profile.id}`,
        type: 'signup',
        title: 'Usuário Cadastrado',
        description: 'Conta criada no MyFlowDay.',
        timestamp: sub?.createdAt || new Date().toISOString(),
        metadata: {
          name: profile.name,
          nickname: profile.nickname,
          profession: profile.profession
        }
      });
    }

    if (sub) {
      timelineItems.push({
        id: `sub_created_${sub.id}`,
        type: 'user_upgraded',
        title: `Assinatura Iniciada (${sub.plan.toUpperCase()})`,
        description: `Assinatura criada no gateway ${sub.gateway.toUpperCase()} com valor de R$ ${sub.price.toFixed(2)}.`,
        timestamp: sub.createdAt,
        metadata: {
          plan: sub.plan,
          price: sub.price,
          gateway: sub.gateway
        }
      });

      if (sub.status === 'canceled') {
        timelineItems.push({
          id: `sub_canceled_${sub.id}`,
          type: 'user_downgraded',
          title: 'Assinatura Cancelada 📉',
          description: `A assinatura foi alterada para cancelada.`,
          timestamp: sub.updatedAt,
          metadata: { status: sub.status }
        });
      } else if (sub.status === 'past_due') {
        timelineItems.push({
          id: `sub_past_due_${sub.id}`,
          type: 'user_downgraded',
          title: 'Assinatura Pendente ⚠️',
          description: `Pagamento em atraso (past_due).`,
          timestamp: sub.updatedAt,
          metadata: { status: sub.status }
        });
      } else if (sub.updatedAt !== sub.createdAt) {
        timelineItems.push({
          id: `sub_updated_${sub.id}`,
          type: 'user_reactivated',
          title: 'Assinatura Atualizada 🔄',
          description: `Estado da assinatura atualizado para ${sub.status}.`,
          timestamp: sub.updatedAt,
          metadata: { status: sub.status }
        });
      }
    }

    timelineItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      userId: targetUserId,
      name: profile?.name || profile?.nickname || 'Usuário Sem Nome',
      plano: sub?.plan || 'free',
      status: sub?.status || 'FREE',
      expiresAt: sub?.currentPeriodEnd || null,
      timeline: timelineItems
    };
  }
};
