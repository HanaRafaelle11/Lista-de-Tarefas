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
      const paymentIdForAttempt = sub.last_payment_id || `sub_${sub.id}_${Date.now()}`;
      
      try {
        // 1. Registrar a tentativa de cobrança no ledger
        await supabaseAdmin.from('payment_ledger').insert([{
          payment_id: paymentIdForAttempt,
          event_type: 'recurrent_charge_attempt',
          status_raw: 'pending',
          status_normalized: 'pending',
          user_id: sub.user_id,
          payload: { subscription_id: sub.id, price: sub.price || PLAN_PREMIUM_MONTHLY_PRICE }
        }]);

        const { data: profileRow } = await supabaseAdmin.from('profiles').select('*').eq('id', sub.user_id).maybeSingle();
        const customerId = await PaymentGateway.ensureCustomer(profileRow || { id: sub.user_id }, sub.metadata?.email, sub.metadata?.cpf);

        // Cobrança recorrente no Asaas
        const pixCharge = await PaymentGateway.createPixCharge({
          customerId,
          amount: Number(sub.price) || PLAN_PREMIUM_MONTHLY_PRICE,
          description: "Recorrência MyFlowDay Premium ⚡",
          externalReference: `mfd_premium_${sub.user_id}`
        });

        successes++;
        const nextExpiry = new Date();
        nextExpiry.setDate(now.getDate() + 30);

        await BillingEngine.processPaymentSuccess({
          userId: sub.user_id,
          customerId,
          paymentId: pixCharge.id,
          billingType: 'pix',
          value: Number(sub.price) || PLAN_PREMIUM_MONTHLY_PRICE,
          periodDays: 30
        });

        await supabaseAdmin.from('payment_ledger').insert([{
          payment_id: String(pixCharge.id),
          event_type: 'recurrent_charge_success',
          status_raw: pixCharge.status,
          status_normalized: 'approved',
          user_id: sub.user_id,
          payload: pixCharge
        }]);

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
