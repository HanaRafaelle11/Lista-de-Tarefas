/**
 * Payment Observability Logger — Single Source of Truth
 *
 * Registra cada etapa do ciclo de vida de um pagamento na tabela payment_events.
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
    const { error: dbErr } = await supabaseAdmin.from('payment_events').insert([{
      timestamp:        new Date().toISOString(),
      user_id:          userId || null,
      subscription_id:  subscriptionId || null,
      payment_id:       paymentId || null,
      customer_id:      customerId || null,
      gateway:          gateway || 'asaas',
      status:           resolvedStatus || 'pending',
      event:            resolvedEvent,
      request:          request || null,
      response:         response || null,
      payload:          payload || null,
      error:            error || null,
      processing_time:  processingTime || null,
      processed:        processed || false,
      source:           source || null
    }]);

    if (dbErr) {
      console.warn(`[PaymentLogger] insert falhou (${dbErr.code}): ${dbErr.message}`);
    } else {
      console.log(`[PaymentLogger] ✅ Evento '${resolvedEvent}' [${resolvedStatus}] registrado. user=${userId ?? 'unknown'}`);
    }
  } catch (err) {
    console.warn('[PaymentLogger] Exception ignorada ao gravar log:', err?.message);
  }
}
