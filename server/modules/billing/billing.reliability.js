/**
 * Billing Reliability Layer & Observability Engine
 * 
 * Monitora a saúde contínua do sistema de cobranças, detecta divergências (Billing Drift)
 * entre assinaturas, eventos e ledger, e calcula o Billing Health Score automático.
 */
import { supabaseAdmin } from '../../../lib/supabase.js';

export const billingReliability = {
  /**
   * Executa uma auditoria automatizada de saúde e consistência no billing de produção.
   */
  async getHealthStatus() {
    const startTime = Date.now();
    const checks = {
      databaseConnection: false,
      billingEventsActive: false,
      billingLedgerActive: false,
      driftCount: 0,
      drifts: [],
      healthScore: 100
    };

    try {
      // 1. Verificar conectividade e existência das tabelas
      const { error: bEvtErr } = await supabaseAdmin.from('billing_events').select('id').limit(1);
      checks.billingEventsActive = !bEvtErr;

      const { error: bLedErr } = await supabaseAdmin.from('billing_ledger').select('id').limit(1);
      checks.billingLedgerActive = !bLedErr;

      checks.databaseConnection = checks.billingEventsActive && checks.billingLedgerActive;

      // 2. Auditoria de Drift entre Assinaturas Ativas e Ledger
      const { data: activeSubs } = await supabaseAdmin
        .from('subscriptions')
        .select('user_id, status, plan, amount')
        .eq('status', 'active');

      if (activeSubs && activeSubs.length > 0) {
        for (const sub of activeSubs) {
          // Verificar se existe registro correspondente em billing_events ou billing_ledger
          const { data: userEvents } = await supabaseAdmin
            .from('billing_events')
            .select('id')
            .eq('user_id', sub.user_id)
            .limit(1);

          if (!userEvents || userEvents.length === 0) {
            checks.driftCount++;
            checks.drifts.push({
              userId: sub.user_id,
              issue: 'Assinatura ativa em subscriptions sem registro em billing_events',
              severity: 'MEDIUM'
            });
          }
        }
      }

      // 3. Calcular Health Score
      let score = 100;
      if (!checks.databaseConnection) score -= 50;
      if (checks.driftCount > 0) score -= Math.min(checks.driftCount * 10, 40);
      checks.healthScore = Math.max(score, 0);

      return {
        status: checks.healthScore >= 90 ? 'HEALTHY' : (checks.healthScore >= 70 ? 'DEGRADED' : 'UNHEALTHY'),
        healthScore: checks.healthScore,
        checks,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        status: 'CRITICAL_ERROR',
        healthScore: 0,
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }
};
