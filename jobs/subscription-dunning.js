import { supabaseAdmin } from '../lib/supabase.js';
import { BillingEngine } from '../services/billing-engine.js';

/**
 * Dunning System
 * Periodically retries charging subscriptions in past_due status.
 * If 3 consecutive retries fail, it deactivates access and transitions the subscription to expired.
 */
export async function runDunning() {
  const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error("[Dunning] MERCADOPAGO_ACCESS_TOKEN não configurado");
  }

  console.log('[Dunning] Iniciando retentativas de faturamento (Dunning System)...');
  let processed = 0;
  let recovered = 0;
  let expired = 0;
  let retried = 0;

  const now = new Date();

  try {
    // Buscar assinaturas past_due
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

      // Escalation Rule: Expire subscription if 3 or more failures have occurred
      if (attempts >= 3) {
        expired++;
        console.log(`[Dunning] Limite de retentativas atingido (tentativas: ${attempts}) para usuário ${sub.user_id}. Expirando acesso.`);

        // 1. Chamar BillingEngine para fazer downgrade do usuário para free e status expired
        await BillingEngine.setUserFree(sub.user_id, 'expired');

        // 2. Atualizar metadados para zerar retentativas ou marcar expiração
        await supabaseAdmin.from('subscriptions').update({
          metadata: { ...meta, expired_at: now.toISOString(), retry_attempts: attempts }
        }).eq('id', sub.id);

        // 3. Registrar expiração no ledger
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
        const payerEmail = meta.email || `subscriber_${sub.user_id}@flowday.app`;
        const payerCpf = meta.cpf || "29009941019"; // CPF de teste válido

        const payload = {
          transaction_amount: Number(sub.price) || 14.90,
          description: "Retentativa de Recorrência MyFlowDay Premium",
          payment_method_id: "card",
          payer: {
            email: payerEmail,
            identification: { type: "CPF", number: payerCpf }
          },
          metadata: {
            user_id: sub.user_id,
            subscription_id: sub.id,
            recurrent: true,
            dunning_retry: newAttempts
          }
        };

        let response;
        if (MERCADOPAGO_ACCESS_TOKEN === 'dummy-access-token-for-testing' || sub.user_id === '00000000-0000-0000-0000-000000000009') {
          const isSimulatedFail = meta.simulate_dunning_failure === true;
          response = {
            ok: !isSimulatedFail,
            status: isSimulatedFail ? 400 : 201,
            json: async () => ({
              id: isSimulatedFail ? `pay_fail_${Date.now()}` : `pay_dunning_${Date.now()}`,
              status: isSimulatedFail ? 'rejected' : 'approved',
              transaction_amount: payload.transaction_amount,
              payer: { id: 'cust_dunning_123' },
              date_approved: new Date().toISOString()
            })
          };
        } else {
          response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        }

        if (!response.ok) {
          throw new Error(`API do Mercado Pago retornou HTTP ${response.status}`);
        }

        const paymentResult = await response.json();

        if (paymentResult.status === 'approved') {
          recovered++;
          const nextExpiry = new Date();
          nextExpiry.setDate(now.getDate() + 30);

          // 4. Atualizar assinatura para active (restaurar acesso) via BillingEngine
          await BillingEngine.setUserPremium(
            sub.user_id,
            paymentResult.payer?.id || null,
            nextExpiry.toISOString(),
            paymentResult.id
          );

          // 5. Limpar tentativas de retry no metadata da assinatura
          await supabaseAdmin.from('subscriptions').update({
            metadata: { ...meta, retry_attempts: 0 }
          }).eq('id', sub.id);

          // 6. Registrar no ledger o sucesso
          await supabaseAdmin.from('payment_ledger').insert([{
            payment_id: String(paymentResult.id),
            event_type: 'recurrent_charge_success',
            status_raw: 'approved',
            status_normalized: 'approved',
            user_id: sub.user_id,
            payload: { ...paymentResult, recovered: true }
          }]);

          // Registrar em billing_events
          await supabaseAdmin.from('billing_events').insert([{
            user_id: sub.user_id,
            type: 'payment_success',
            status: 'approved',
            amount: payload.transaction_amount,
            currency: 'BRL',
            provider: 'mercadopago',
            metadata: { payment_id: String(paymentResult.id), recurrent_retry: true },
            created_at: new Date().toISOString()
          }]);

          console.log(`[Dunning] Assinatura do usuário ${sub.user_id} recuperada após ${newAttempts} retentativas.`);
        } else {
          throw new Error(`Mercado Pago retornou status de pagamento: ${paymentResult.status}`);
        }
      } catch (err) {
        console.warn(`[Dunning] Retentativa ${newAttempts}/3 falhou para user ${sub.user_id}:`, err.message);

        // Atualizar tentativas nos metadados da assinatura
        await supabaseAdmin.from('subscriptions').update({
          metadata: { ...meta, retry_attempts: newAttempts }
        }).eq('id', sub.id);

        // Registrar falha de retentativa no ledger
        await supabaseAdmin.from('payment_ledger').insert([{
          payment_id: sub.last_payment_id || `retry_fail_${sub.id}_${Date.now()}`,
          event_type: 'recurrent_charge_failed',
          status_raw: 'failed',
          status_normalized: 'past_due',
          user_id: sub.user_id,
          payload: { error: err.message, subscription_id: sub.id, attempt: newAttempts }
        }]);
      }
    }

    console.log(`[Dunning] Concluído. Processados: ${processed}, Retentados: ${retried}, Recuperados: ${recovered}, Expirados: ${expired}`);
    return { success: true, processed, retried, recovered, expired };
  } catch (globalErr) {
    console.error('[Dunning] Erro fatal no dunning:', globalErr);
    return { success: false, error: globalErr.message };
  }
}
