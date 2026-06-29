import { supabaseAdmin } from '../../services/supabase/client.js';
import { logger } from '../../services/logger/logger.js';

/**
 * EventBus (EDA Nível 2)
 * Publica eventos no Event Store (tabela public.events) de forma atômica e idempotente.
 */
export async function publishEvent(type, payload = {}, idempotencyKey = null) {
  if (!type) throw new Error('[EventBus] O tipo do evento é obrigatório.');

  const key = idempotencyKey || `evt_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  logger.info(`[EventBus] Publicando evento: ${type}`, { key, payload });

  if (!supabaseAdmin) {
    logger.warn('[EventBus] Supabase Admin Client indisponível no ambiente local. Evento emulado.');
    return { id: `mock_${Date.now()}`, type, payload, status: 'pending', idempotency_key: key };
  }

  const { data, error } = await supabaseAdmin
    .from('events')
    .insert({
      type,
      payload,
      idempotency_key: key,
      status: 'pending'
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') { // Chave de idempotência duplicada
      logger.info(`[EventBus] Evento ignorado (chave de idempotência existente): ${key}`);
      return { duplicate: true, idempotencyKey: key };
    }
    logger.error(`[EventBus] Erro ao publicar evento ${type}:`, { error: error.message });
    throw error;
  }

  return data;
}
