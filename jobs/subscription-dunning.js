import { supabaseAdmin } from '../lib/supabase.js';
import { BillingEngine } from '../api/billing-engine.js';
import { PaymentGateway } from '../lib/paymentGateway/index.js';

/**
 * Dunning System
 * Periodically retries charging subscriptions in past_due status via Asaas.
 */
export async function runDunning() {
  console.log('[Dunning] Iniciando retentativas de faturamento (Dunning System Asaas)...');
  let processed = 0;
  let recovered = 0;
  let expired = 0;
  let retried = 0;

  const now = new Date();

  try {
    const { data: pastDueSubs, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('status', 'past_due');

    if (error) {
      console.error('[Dunning] Erro ao buscar assinaturas past_due no Supabase:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[Dunning] Encontradas ${pastDueSubs.length} assinaturas past_due para auditoria.`);

    for (const sub of pastDueSubs) {
      processed++;
      const meta = sub.metadata || {};
      const attempts = meta.retry_attempts || 0;

      if (attempts >= 3) {
        expired++;
        console.log(`[Dunning] Limite de retentativas atingido (${attempts}) para usuário ${sub.user_id}. Expirando acesso.`);

        await BillingEngine.setUserFree(sub.user_id, 'expired');
        await supabaseAdmin.from('subscriptions').update({
          metadata: { ...meta, expired_at: now.toISOString(), retry_attempts: attempts }
        }).eq('id', sub.id);

        await supabaseAdmin.from('payment_ledger').insert([{
          payment_id: sub.last_payment_id || `exp_${sub.id}_${Date.now()}`,
          event_type: 'subscription_expired',
          status_raw: 'expired',
          status_normalized: 'expired',
          user_id: sub.user_id,
          payload: { subscription_id: sub.id, reason: 'consecutive_payment_failures', total_attempts: attempts }
        }]);
        continue;
      }

      retried++;
      const newAttempts = attempts + 1;

      try {
        const { data: profileRow } = await supabaseAdmin.from('profiles').select('*').eq('id', sub.user_id).maybeSingle();
        const customerId = await PaymentGateway.ensureCustomer(profileRow || { id: sub.user_id }, meta.email, meta.cpf);

        const pixCharge = await PaymentGateway.createPixCharge({
          customerId,
          amount: Number(sub.price) || 14.90,
          description: "Retentativa Recorrência MyFlowDay Premium ⚡",
          externalReference: `mfd_premium_${sub.user_id}`
        });

        recovered++;
        await BillingEngine.setUserPremium(sub.user_id, customerId, null, pixCharge.id);

        await supabaseAdmin.from('subscriptions').update({
          metadata: { ...meta, retry_attempts: 0, recovered_at: now.toISOString() }
        }).eq('id', sub.id);

      } catch (err) {
        console.error(`[Dunning] Retentativa ${newAttempts} falhou para usuário ${sub.user_id}:`, err.message);
        await supabaseAdmin.from('subscriptions').update({
          metadata: { ...meta, retry_attempts: newAttempts, last_retry_at: now.toISOString() }
        }).eq('id', sub.id);
      }
    }

    return { success: true, processed, recovered, expired, retried };
  } catch (globalErr) {
    console.error('[Dunning] Erro global no dunning system:', globalErr.message);
    return { success: false, error: globalErr.message };
  }
}
