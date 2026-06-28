/**
 * Idempotency Store Module (V2)
 * 
 * Garante fisicamente que cada evento financeiro externo (ex: Asaas paymentId)
 * seja processado exatamente UMA VEZ no billing_ledger. Impedimento absoluto de duplicação.
 */
import { supabaseAdmin } from '../../../../lib/supabase.js';

const memoryIdempotencySet = new Set();

export const idempotencyStore = {
  async isProcessed(idempotencyKey) {
    if (!idempotencyKey) return false;
    const keyStr = String(idempotencyKey).trim();
    
    if (memoryIdempotencySet.has(keyStr)) {
      return true;
    }

    try {
      // Verificar se já existe no ledger por reference_id ou em billing_events por payment_id
      const { data: ledgerMatch } = await supabaseAdmin
        .from('billing_ledger')
        .select('id')
        .eq('reference_id', keyStr)
        .limit(1)
        .maybeSingle();

      if (ledgerMatch) {
        memoryIdempotencySet.add(keyStr);
        return true;
      }

      const { data: eventMatch } = await supabaseAdmin
        .from('billing_events')
        .select('id')
        .or(`payment_id.eq.${keyStr},asaas_payment_id.eq.${keyStr}`)
        .limit(1)
        .maybeSingle();

      if (eventMatch) {
        memoryIdempotencySet.add(keyStr);
        return true;
      }
    } catch (_) {}

    return false;
  },

  markProcessed(idempotencyKey) {
    if (idempotencyKey) {
      memoryIdempotencySet.add(String(idempotencyKey).trim());
    }
  }
};
