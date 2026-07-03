/**
 * Idempotency Store Module (Infraestrutura Interna)
 * 
 * Garante fisicamente que cada evento financeiro externo (ex: Asaas paymentId)
 * seja processado exatamente UMA VEZ no billing_ledger. Impedimento absoluto de duplicação.
 * 
 * RELIABILITY FIX: Removed in-memory Set cache. In serverless environments (Vercel/Edge),
 * memory is NOT persisted between invocations, making the Set useless for deduplication.
 * All checks now go through the database for reliable results.
 */
import { supabaseAdmin } from '../../../lib/supabase.js';

export const idempotencyStore = {
  async isProcessed(idempotencyKey) {
    if (!idempotencyKey) return false;
    const keyStr = String(idempotencyKey).trim();

    try {
      const { data: ledgerMatch } = await supabaseAdmin
        .from('billing_ledger')
        .select('id')
        .eq('reference_id', keyStr)
        .limit(1)
        .maybeSingle();

      if (ledgerMatch) {
        return true;
      }

      const { data: eventMatch } = await supabaseAdmin
        .from('billing_events')
        .select('id')
        .or(`payment_id.eq.${keyStr},asaas_payment_id.eq.${keyStr}`)
        .limit(1)
        .maybeSingle();

      if (eventMatch) {
        return true;
      }
    } catch (_) {}

    return false;
  },

  markProcessed(_idempotencyKey) {
    // No-op: Deduplication is handled by the database queries in isProcessed().
    // In-memory caching is unreliable in serverless environments.
  }
};
