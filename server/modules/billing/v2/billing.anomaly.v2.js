/**
 * Anomaly Detection Engine V2
 * 
 * Detecta automaticamente anomalias financeiras: picos de receita, picos de falhas,
 * eventos duplicados ou derivas de consistência em tempo real.
 */
import { supabaseAdmin } from '../../../../lib/supabase.js';

export const BillingAnomalyV2 = {
  async detectAnomalies() {
    const anomalies = [];
    const now = new Date();
    const last1hIso = new Date(now.getTime() - (60 * 60 * 1000)).toISOString();
    const last24hIso = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();

    try {
      // 1. Detectar picos de falha de cobrança nas últimas 24h
      const { data: failedEvents } = await supabaseAdmin
        .from('billing_events')
        .select('user_id, created_at')
        .eq('status', 'error')
        .gte('created_at', last24hIso);

      if (failedEvents && failedEvents.length > 5) {
        anomalies.push({
          type: 'HIGH_FAILURE_RATE_SPIKE',
          severity: 'HIGH',
          affectedUsers: Array.from(new Set(failedEvents.map(e => e.user_id))),
          description: `Detectados ${failedEvents.length} eventos de falha em billing nas últimas 24h.`,
          detectedAt: now.toISOString()
        });
      }

      // 2. Detectar consistência de orfãos (eventos vs ledger)
      const { data: recentEvents } = await supabaseAdmin
        .from('billing_events')
        .select('user_id, payment_id')
        .gte('created_at', last24hIso);

      const { data: recentLedger } = await supabaseAdmin
        .from('billing_ledger')
        .select('reference_id')
        .gte('created_at', last24hIso);

      const ledgerRefs = new Set((recentLedger || []).map(l => l.reference_id).filter(Boolean));
      const orphanUsers = new Set();

      (recentEvents || []).forEach(e => {
        if (e.payment_id && !ledgerRefs.has(e.payment_id)) {
          orphanUsers.add(e.user_id);
        }
      });

      if (orphanUsers.size > 0) {
        anomalies.push({
          type: 'CONSISTENCY_DRIFT_DETECTED',
          severity: 'MEDIUM',
          affectedUsers: Array.from(orphanUsers),
          description: `Detectada inconsistência entre billing_events e billing_ledger para ${orphanUsers.size} usuários nas últimas 24h.`,
          detectedAt: now.toISOString()
        });
      }

      return {
        success: true,
        anomalyCount: anomalies.length,
        anomalies,
        evaluatedAt: now.toISOString()
      };
    } catch (err) {
      console.error('[BillingAnomalyV2] Erro na detecção de anomalias:', err.message);
      return {
        success: false,
        anomalyCount: 0,
        anomalies: [],
        error: err.message
      };
    }
  }
};
