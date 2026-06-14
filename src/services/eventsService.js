import { supabase } from '../supabaseClient';
import { enqueue, flush } from './syncQueue';

/**
 * eventsService — Registro de eventos analíticos com fallback resiliente.
 *
 * Comportamento:
 * - Tenta gravar no Supabase imediatamente.
 * - Se falhar → enfileira na syncQueue para retry automático.
 * - Nunca perde um evento silenciosamente.
 * - Nunca lança erro para o chamador.
 */
export const eventsService = {
  /**
   * Registra um evento analítico.
   * Nunca falha visualmente — usa syncQueue como fallback.
   */
  logEvent: async (userId, eventType, metadata = {}) => {
    if (!userId) return { error: 'userId obrigatório' };
    try {
      const { error } = await supabase
        .from('events')
        .insert([{ user_id: userId, event_type: eventType, metadata }]);

      if (error) {
        // Enfileira para retry — não perde o evento
        enqueue('event', { userId, eventType, metadata });
        console.warn(`[eventsService] Evento "${eventType}" enfileirado para retry:`, error.message);
        return { error, degraded: true };
      }
      return { error: null };
    } catch (e) {
      // Falha de rede — enfileira para retry
      enqueue('event', { userId, eventType, metadata });
      console.warn(`[eventsService] Falha de rede para evento "${eventType}", enfileirado para retry`);
      return { error: e, degraded: true };
    }
  },

  /**
   * Tenta reenviar eventos locais pendentes para o Supabase.
   * A syncQueue já faz isso automaticamente, mas pode ser chamado manualmente.
   */
  flushLocalEvents: async (_userId) => {
    await flush();
  }
};
