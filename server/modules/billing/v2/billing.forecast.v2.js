/**
 * Forecast Engine V2
 * 
 * Executa simulação e projeção financeira básica com base no histórico do billing_ledger e assinaturas ativas.
 */
import { supabaseAdmin } from '../../../../lib/supabase.js';

export const BillingForecastV2 = {
  async generateForecast() {
    try {
      const now = new Date();
      const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      // 1. Assinaturas ativas para estimativa MRR
      const { data: activeSubs } = await supabaseAdmin
        .from('subscriptions')
        .select('amount, price')
        .eq('status', 'active');

      const currentMrr = (activeSubs || []).reduce((acc, sub) => acc + Number(sub.amount || sub.price || 0), 0);
      const estimatedMonthlyRevenue = Math.round(currentMrr * 100) / 100;
      const estimatedArr = Math.round(estimatedMonthlyRevenue * 12 * 100) / 100;

      // 2. Transações reais do mês no ledger
      const { data: monthLedger } = await supabaseAdmin
        .from('billing_ledger')
        .select('balance_change')
        .gte('created_at', startOfMonthStr);

      const realizedMonthRevenue = (monthLedger || []).reduce((acc, l) => acc + Number(l.balance_change || 0), 0);

      // 3. Tendência e Previsão de Churn
      const { data: canceledSubs } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('status', 'canceled');

      const totalSubsCount = (activeSubs || []).length + (canceledSubs || []).length;
      const churnRate = totalSubsCount > 0 ? Math.round(((canceledSubs || []).length / totalSubsCount) * 100) : 0;

      let revenueTrend = 'STABLE';
      if (realizedMonthRevenue > currentMrr * 0.8) revenueTrend = 'GROWING';
      if (churnRate > 15) revenueTrend = 'DECLINING';

      return {
        success: true,
        forecast: {
          estimatedMonthlyRevenue,
          estimatedArr,
          realizedMonthRevenue: Math.round(realizedMonthRevenue * 100) / 100,
          revenueTrend,
          churnRatePercentage: churnRate,
          predictedChurnImpactMonthly: Math.round((currentMrr * (churnRate / 100)) * 100) / 100
        },
        calculatedAt: now.toISOString()
      };
    } catch (err) {
      console.error('[BillingForecastV2] Erro ao gerar forecast:', err.message);
      return {
        success: false,
        forecast: null,
        error: err.message
      };
    }
  }
};
