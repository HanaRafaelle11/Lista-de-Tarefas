import { supabaseAdmin } from '../lib/supabase.js';
import { BillingEngine } from '../lib/billing/engine.js';
import { PaymentGateway } from '../lib/paymentGateway/index.js';
import { PLAN_PREMIUM_MONTHLY_PRICE } from '../lib/billing/config.js';

/**
 * Billing Cycle Engine
 * Periodic background job that processes recurrent subscription renewals.
 */
export async function runBillingCycle() {
  console.log('[Billing Cycle] Iniciando ciclo de faturamento recorrente via Asaas...');
  let processed = 0;
  let successes = 0;
  let failures = 0;

  const now = new Date();

  try {
    // Buscar assinaturas ativas cujo período atual terminou
    const { data: activeSubs, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .lte('current_period_end', now.toISOString());

    if (error) {
      console.error('[Billing Cycle] Erro ao buscar assinaturas vencidas no Supabase:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[Billing Cycle] Encontradas ${activeSubs.length} assinaturas vencidas para processamento.`);

    for (const sub of activeSubs) {
      processed++;
      const isCreditCard = sub.auto_renew === true || sub.billing_type === 'credit_card';
      if (isCreditCard) {
        console.log(`[Billing Cycle] Assinatura do usuário ${sub.user_id} é de cartão de crédito (auto_renew). Ignorando cobrança manual no ciclo.`);
        continue;
      }
      const paymentIdForAttempt = sub.last_payment_id || `sub_${sub.id}_${Date.now()}`;
      
      try {
        // 1. Registrar a tentativa de cobrança no ledger
        try {
          await supabaseAdmin.from('billing_events').insert([{
            user_id: sub.user_id,
            event_type: 'recurrent_charge_attempt',
            status: 'pending',
            payment_id: paymentIdForAttempt,
            value: sub.price || PLAN_PREMIUM_MONTHLY_PRICE,
            created_at: new Date().toISOString(),
            metadata: { subscription_id: sub.id }
          }]);
        } catch (ledgerErr) {
          console.warn('[Billing Cycle] Aviso ao inserir billing_event:', ledgerErr.message);
        }

        const { data: profileRow } = await supabaseAdmin.from('profiles').select('*').eq('id', sub.user_id).maybeSingle();
        const customerId = await PaymentGateway.ensureCustomer(profileRow || { id: sub.user_id }, sub.metadata?.email, sub.metadata?.cpf);

        // Cobrança recorrente no Asaas
        const pixCharge = await PaymentGateway.createPixCharge({
          customerId,
          amount: Number(sub.price) || PLAN_PREMIUM_MONTHLY_PRICE,
          description: "Recorrência MyFlowDay Premium",
          externalReference: `mfd_premium_${sub.user_id}`
        });

        successes++;
        console.log(`[Billing Cycle] Cobrança gerada para ${sub.user_id}: ${pixCharge.id}. Aguardando webhook de confirmação.`);

        // SECURITY FIX: Do NOT call processPaymentSuccess() here!
        // The charge was GENERATED, not PAID. We must wait for the Asaas webhook
        // (PAYMENT_RECEIVED / PAYMENT_CONFIRMED) to activate Pro access.
        // Only update the last_payment_id for tracking.
        try {
          await supabaseAdmin.from('subscriptions').update({
            last_payment_id: String(pixCharge.id),
            updated_at: new Date().toISOString()
          }).eq('user_id', sub.user_id);
        } catch (updateErr) {
          console.warn('[Billing Cycle] Aviso ao atualizar last_payment_id:', updateErr.message);
        }

      } catch (err) {
        failures++;
        console.error(`[Billing Cycle] Erro ao processar cobrança da assinatura ${sub.id}:`, err.message);
        await BillingEngine.processPaymentOverdue({ userId: sub.user_id });
      }
    }

    return { success: true, processed, successes, failures };
  } catch (globalErr) {
    console.error('[Billing Cycle] Erro global no ciclo de faturamento:', globalErr.message);
    return { success: false, error: globalErr.message };
  }
}
