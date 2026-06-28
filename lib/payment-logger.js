/**
 * Payment Observability Logger — Single Source of Truth
 *
 * Registra cada etapa do ciclo de vida de um pagamento na tabela oficial `billing_events`.
 * Nunca lança exceção — falha silenciosa para não interromper o fluxo principal.
 */
import { supabaseAdmin } from './supabase.js';

/**
 * @param {object} params
 * @param {string|null} [params.userId]
 * @param {string|null} [params.subscriptionId]
 * @param {string|null} [params.paymentId]
 * @param {string|null} [params.customerId]
 * @param {string}      [params.gateway='asaas']
 * @param {string}      [params.status='pending']      pending | success | error
 * @param {string}      params.event                  Tipo de evento (ex: checkout_started, payment_approved, webhook_received)
 * @param {object|null} [params.request]              Metadata da requisição
 * @param {object|null} [params.response]             Metadata da resposta
 * @param {object|null} [params.payload]              Dados/payload extras
 * @param {string|null} [params.error]                Mensagem de erro
 * @param {number|null} [params.processingTime]       Tempo de processamento em ms
 * @param {boolean}     [params.processed=false]      Se já foi processado
 * @param {string|null} [params.source]               Origem do evento (frontend, webhook, cron, etc.)
 */
export async function logPaymentEvent({
  userId = null,
  subscriptionId = null,
  paymentId = null,
  customerId = null,
  gateway = 'asaas',
  status = 'pending',
  event,
  request = null,
  response = null,
  payload = null,
  error = null,
  processingTime = null,
  processed = false,
  source = null
}) {
  if (!event) {
    console.warn('[PaymentLogger] logPaymentEvent chamado sem event — ignorado.');
    return;
  }

  // Obter tipo de evento e status normalizados
  const resolvedEvent = String(event).toLowerCase().trim();
  const resolvedStatus = String(status).toLowerCase().trim();

  try {
    const { error: dbErr } = await supabaseAdmin.from('billing_events').insert([{
      user_id:          userId || 'system',
      type:             resolvedEvent,
      event_type:       resolvedEvent,
      status:           resolvedStatus || 'pending',
      payment_id:       paymentId || null,
      asaas_payment_id: paymentId || null,
      subscription_id:  subscriptionId || null,
      provider:         gateway || 'asaas',
      value:            payload?.amount || payload?.value || 0,
      amount:           payload?.amount || payload?.value || 0,
      created_at:       new Date().toISOString(),
      metadata: {
        customerId,
        request,
        response,
        payload,
        error,
        processingTime,
        processed,
        source
      }
    }]);

    if (dbErr) {
      console.warn('[PaymentLogger] Aviso ao gravar em billing_events:', dbErr.message);
    }
  } catch (err) {
    console.warn('[PaymentLogger] Exceção capturada em logPaymentEvent:', err.message);
  }
}
