import { trackEvent, flushBatch } from './eventBatcher';

/**
 * eventsService — Registro de eventos analíticos com fallback resiliente e batching.
 *
 * Comportamento:
 * - Acumula eventos e faz envio agrupado (batching) a cada 15s ou 15 itens.
 * - Suporta IndexedDB completo para não perder eventos se o app fechar.
 */
export const eventsService = {
  /**
   * Registra um evento analítico via eventBatcher.
   * Totalmente não-bloqueante e offline-first.
   */
  logEvent: async (userId, eventType, metadata = {}) => {
    if (!userId) return { error: 'userId obrigatório' };
    try {
      // Delegar ao batcher estruturado
      trackEvent(userId, eventType, metadata);
      return { error: null };
    } catch (e) {
      console.warn(`[eventsService] Falha ao registrar evento "${eventType}":`, e.message);
      return { error: e, degraded: true };
    }
  },

  /**
   * Força o envio imediato dos eventos acumulados.
   */
  flushLocalEvents: async (_userId) => {
    await flushBatch();
  }
};
