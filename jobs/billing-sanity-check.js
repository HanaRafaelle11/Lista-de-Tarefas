import { supabaseAdmin } from '../lib/supabase.js';
import { logPaymentEvent } from '../lib/payment-logger.js';

/**
 * Sanity Check Automático de Billing (Job de Consistência)
 * Executado periodicamente para detectar e corrigir divergências de runtime.
 */
export async function runBillingSanityCheck() {
  console.log('[SanityCheck] Executando verificação periódica de consistência...');
  let checkedUsers = 0;
  let inconsistenciesFound = 0;
  let autoCorrected = 0;

  try {
    const { data: activeSubs, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .eq('provider', 'asaas');

    if (error) {
      console.error('[SanityCheck] Erro ao consultar assinaturas ativas:', error.message);
      return { success: false, error: error.message };
    }

    const subsByUser = {};
    for (const sub of activeSubs) {
      if (!subsByUser[sub.user_id]) subsByUser[sub.user_id] = [];
      subsByUser[sub.user_id].push(sub);
    }

    for (const [userId, subs] of Object.entries(subsByUser)) {
      checkedUsers++;
      if (subs.length > 1) {
        inconsistenciesFound++;
        console.warn(`[SanityCheck ⚠️] Usuário ${userId} possui ${subs.length} assinaturas ativas concorrentes! Executando autocorreção...`);

        subs.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
        const supersededSubs = subs.slice(1);

        for (const sup of supersededSubs) {
          const currentMeta = sup.metadata || {};
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'superseded',
              metadata: { ...currentMeta, reason: 'sanity_check_autocorrect' },
              updated_at: new Date().toISOString()
            })
            .eq('id', sup.id);

          autoCorrected++;
        }

        await logPaymentEvent({
          userId,
          event: 'sanity_check_inconsistency_corrected',
          status: 'success',
          payload: { totalActiveFound: subs.length, correctedCount: supersededSubs.length }
        });
      }
    }

    console.log(`[SanityCheck ✅] Concluído. Usuários auditados: ${checkedUsers} | Inconsistências: ${inconsistenciesFound} | Autocorrigidos: ${autoCorrected}`);
    return { success: true, checkedUsers, inconsistenciesFound, autoCorrected };

  } catch (err) {
    console.error('[SanityCheck ❌] Exceção na verificação de sanity:', err.message);
    return { success: false, error: err.message };
  }
}
