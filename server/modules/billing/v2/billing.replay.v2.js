/**
 * Billing Replay Engine V2
 * 
 * Permite o reprocessamento seguro e idempotente de eventos financeiros históricos.
 * NUNCA duplica lançamentos no ledger devido à checagem estrita da idempotencyStore.
 */
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { BillingEngineV2 } from './billing.engine.v2.js';

export const BillingReplayV2 = {
  async replay({ fromDate, toDate, eventTypes = [], dryRun = true }) {
    const startTime = Date.now();
    console.log(`[BillingReplayV2] [replay_executed] Iniciando Replay (dryRun=${dryRun}) de ${fromDate || 'início'} até ${toDate || 'hoje'}`);

    const logs = [];
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
      let query = supabaseAdmin.from('billing_events').select('*').order('created_at', { ascending: true });
      if (fromDate) query = query.gte('created_at', fromDate);
      if (toDate) query = query.lte('created_at', toDate);

      const { data: events, error } = await query;
      if (error) throw error;

      for (const evt of events || []) {
        if (eventTypes.length > 0 && !eventTypes.includes(evt.type) && !eventTypes.includes(evt.event_type)) {
          continue;
        }

        const idempotencyKey = evt.payment_id || evt.asaas_payment_id || evt.id;
        
        if (dryRun) {
          logs.push({
            eventId: evt.id,
            idempotencyKey,
            action: 'SIMULATED',
            status: 'DRY_RUN_OK'
          });
          processedCount++;
        } else {
          const result = await BillingEngineV2.process({
            eventId: `replay_${evt.id}`,
            eventType: evt.type || evt.event_type || 'payment',
            payload: {
              userId: evt.user_id,
              amount: evt.amount || evt.value,
              reason: `Replay: ${evt.type || 'payment'}`
            },
            source: 'replay_engine',
            idempotencyKey
          });

          if (result.status === 'IDEMPOTENT_SKIP') skippedCount++;
          else if (result.success) processedCount++;
          else errorCount++;

          logs.push({
            eventId: evt.id,
            idempotencyKey,
            result
          });
        }
      }

      return {
        success: true,
        dryRun,
        summary: {
          totalEvaluated: (events || []).length,
          processedCount,
          skippedCount,
          errorCount,
          durationMs: Date.now() - startTime
        },
        logs
      };
    } catch (err) {
      console.error('[BillingReplayV2] Erro durante reprocessamento:', err.message);
      return {
        success: false,
        error: err.message,
        durationMs: Date.now() - startTime
      };
    }
  }
};
