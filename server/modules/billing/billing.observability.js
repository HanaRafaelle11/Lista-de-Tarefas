/**
 * Billing Observability Layer — NÍVEL 3 (Diagnóstico Interno Sem Poder de Ação)
 * 
 * Unifica Health Score, Anomalias e Consistência em um único módulo de diagnostico interno.
 * 
 * REGRAS DE GOVERNANÇA:
 * ❌ NÃO pode alterar dados ou chamar o engine
 * ❌ NÃO pode escrever no ledger ou decidir cobrança
 * ❌ NÃO pode bloquear o sistema ou alterar estado
 * ✔ Apenas observa, diagnostica e sinaliza telemetria interna
 */
import { supabaseAdmin } from '../../lib/supabase.js';

export const billingObservability = {
  async getSystemDiagnostics() {
    const startTime = Date.now();
    const now = new Date();
    const last24hIso = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();

    const diagnostics = {
      timestamp: now.toISOString(),
      healthScore: 100,
      status: 'HEALTHY',
      connectivity: { events: false, ledger: false },
      metrics: { failedLast24h: 0, consistencyRate: 100 },
      anomalies: []
    };

    try {
      // 1. Diagnóstico de Conectividade
      const { error: evtErr } = await supabaseAdmin.from('billing_events').select('id').limit(1);
      diagnostics.connectivity.events = !evtErr;

      const { error: ledErr } = await supabaseAdmin.from('billing_ledger').select('id').limit(1);
      diagnostics.connectivity.ledger = !ledErr;

      // 2. Diagnóstico de Falhas Recentes
      const { data: failedEvts } = await supabaseAdmin
        .from('billing_events')
        .select('id')
        .eq('status', 'error')
        .gte('created_at', last24hIso);

      diagnostics.metrics.failedLast24h = failedEvts ? failedEvts.length : 0;

      if (diagnostics.metrics.failedLast24h > 5) {
        diagnostics.anomalies.push({
          type: 'SPIKE_FAILURE_RATE',
          severity: 'HIGH',
          description: `Detectados ${diagnostics.metrics.failedLast24h} eventos de falha em 24h.`
        });
      }

      // 3. Cálculo de Health Score Passivo
      let score = 100;
      if (!diagnostics.connectivity.events || !diagnostics.connectivity.ledger) score -= 50;
      if (diagnostics.metrics.failedLast24h > 0) score -= Math.min(diagnostics.metrics.failedLast24h * 5, 30);

      diagnostics.healthScore = Math.max(score, 0);
      diagnostics.status = diagnostics.healthScore >= 90 ? 'HEALTHY' : (diagnostics.healthScore >= 70 ? 'DEGRADED' : 'UNHEALTHY');
      diagnostics.latencyMs = Date.now() - startTime;

      return diagnostics;
    } catch (err) {
      return {
        timestamp: now.toISOString(),
        healthScore: 0,
        status: 'CRITICAL_ERROR',
        error: err.message
      };
    }
  }
};
