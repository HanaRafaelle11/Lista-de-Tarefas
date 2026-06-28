/**
 * Billing Engine V2 — Stripe-Grade Financial Processing Unit
 * 
 * Processa eventos financeiros em shadow mode / V2 coexistindo com V1.
 * Valida versão, verifica idempotência estrita, grava no ledger append-only e registra observabilidade.
 */
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { idempotencyStore } from './idempotency.store.js';
import { createVersionedEvent } from './event.versioning.js';

export const BillingEngineV2 = {
  async process(eventInput) {
    const startTime = Date.now();
    const event = createVersionedEvent(eventInput);
    console.log(`[BillingEngineV2] [event_received] EventId: ${event.eventId} | Type: ${event.eventType}`);

    // 1. Verificar Idempotência Estrita
    const alreadyProcessed = await idempotencyStore.isProcessed(event.idempotencyKey);
    if (alreadyProcessed) {
      console.log(`[BillingEngineV2] [idempotency_hit] EventId: ${event.eventId} | Key: ${event.idempotencyKey} já processado. Ignorando.`);
      return {
        success: true,
        status: 'IDEMPOTENT_SKIP',
        eventId: event.eventId,
        idempotencyKey: event.idempotencyKey,
        ledgerCreated: false
      };
    }

    try {
      const userId = event.payload?.userId || event.payload?.user_id || 'system';
      const amount = Number(event.payload?.amount || event.payload?.value || 0);
      const reason = event.payload?.reason || event.eventType;

      // 2. Gravar em billing_events (Source of Truth)
      await supabaseAdmin.from('billing_events').insert([{
        user_id: userId,
        type: event.eventType,
        event_type: event.eventType,
        status: 'paid',
        payment_id: event.idempotencyKey,
        asaas_payment_id: event.idempotencyKey,
        value: amount,
        amount: amount,
        provider: event.source || 'asaas',
        created_at: event.createdAt,
        metadata: {
          version: event.version,
          payload: event.payload
        }
      }]);

      // 3. Gravar em billing_ledger (Financial Truth Append-Only)
      await supabaseAdmin.from('billing_ledger').insert([{
        user_id: userId,
        balance_change: amount,
        reason: reason,
        reference_id: event.idempotencyKey,
        created_at: event.createdAt
      }]);

      console.log(`[BillingEngineV2] [ledger_created] EventId: ${event.eventId} | Amount: R$ ${amount}`);
      idempotencyStore.markProcessed(event.idempotencyKey);

      console.log(`[BillingEngineV2] [event_processed] EventId: ${event.eventId} em ${Date.now() - startTime}ms`);

      return {
        success: true,
        status: 'PROCESSED',
        eventId: event.eventId,
        idempotencyKey: event.idempotencyKey,
        ledgerCreated: true
      };
    } catch (err) {
      console.error(`[BillingEngineV2] [processing_error] EventId: ${event.eventId}:`, err.message);
      return {
        success: false,
        status: 'ERROR',
        error: err.message
      };
    }
  }
};
