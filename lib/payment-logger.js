/**
 * Payment Observability Logger — Single Source of Truth
 *
 * Registra cada etapa do ciclo de vida de um pagamento na tabela payment_events.
 * Nunca lança exceção — falha silenciosa para não interromper o fluxo de pagamento.
 *
 * event_type possíveis:
 *   checkout_started | checkout_completed | checkout_error
 *   webhook_received | payment_approved | payment_failed | payment_overdue
 *   subscription_updated | subscription_canceled
 *   consistency_error | error
 *
 * status: 'pending' | 'success' | 'error'
 */
import { supabaseAdmin } from './supabase.js';

/**
 * @param {object} params
 * @param {string|null} params.userId
 * @param {string}      [params.provider='asaas']
 * @param {string}      params.eventType
 * @param {string}      [params.status='pending']   pending | success | error
 * @param {string|null} [params.referenceId]        paymentId ou subscriptionId
 * @param {string|null} [params.sessionId]          ID de sessão de checkout (frontend)
 * @param {object|null} [params.payload]            dados extras (jsonb)
 * @param {string|null} [params.errorMessage]       mensagem de erro, se houver
 */
export async function logPaymentEvent({
  userId = null,
  provider = 'asaas',
  eventType,
  status = 'pending',
  referenceId = null,
  sessionId = null,
  payload = null,
  errorMessage = null,
}) {
  if (!eventType) {
    console.warn('[PaymentLogger] logPaymentEvent chamado sem eventType — ignorado.');
    return;
  }
  try {
    const { error } = await supabaseAdmin.from('payment_events').insert([{
      user_id:       userId   || null,
      provider:      provider || 'asaas',
      event_type:    eventType,
      status:        status   || 'pending',
      reference_id:  referenceId  || null,
      session_id:    sessionId    || null,
      payload:       payload      || null,
      error_message: errorMessage || null,
      created_at:    new Date().toISOString(),
    }]);

    if (error) {
      // Falha não-crítica: loga no console mas não propaga
      console.warn(`[PaymentLogger] insert falhou (${error.code}): ${error.message}`);
    } else {
      console.log(`[PaymentLogger] ✅ ${eventType} [${status}] user=${userId ?? 'unknown'} ref=${referenceId ?? '-'}`);
    }
  } catch (err) {
    console.warn('[PaymentLogger] exception ignorada:', err?.message);
  }
}
