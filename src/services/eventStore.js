/**
 * eventStore.js — Armazenamento local de Event Sourcing
 *
 * Persiste todos os eventos comportamentais e transacionais do usuário no IndexedDB
 * de forma que o estado da aplicação possa ser reconstruído a qualquer momento.
 */

import { localDB } from '../db/localDB';
import { generateId } from './syncQueue';
import { eventEmitter } from './eventEmitter';

export const eventStore = {
  /**
   * Salva um evento no banco de dados local.
   * Dispara notificação no barramento de eventos central.
   *
   * @param {string} userId
   * @param {string} eventType - tipo do evento (ex: 'task_created')
   * @param {object} [metadata]
   * @returns {Promise<object>} O evento persistido
   */
  async saveEvent(userId, eventType, metadata = {}) {
    if (!userId) throw new Error('[eventStore] userId é obrigatório para salvar evento');

    const eventId = metadata?.event_id || generateId();

    // Idempotência: Se o evento já existe localmente, evita reinserir
    try {
      const existing = await localDB.get('events', eventId);
      if (existing) {
        console.debug('[eventStore] Evento duplicado ignorado localmente:', eventId);
        return existing;
      }
    } catch {}

    const event = {
      id: eventId,
      user_id: userId,
      event_type: eventType,
      metadata: metadata || {},
      event_version: 1, // Versionamento do evento para compatibilidade futura
      created_at: metadata?.created_at || new Date().toISOString()
    };

    // 1. Salva no IndexedDB
    await localDB.put('events', event);

    // 2. Dispara evento no barramento síncrono local
    eventEmitter.emit(eventType, event);
    eventEmitter.emit('*', event); // Coringa para escuta global de replays/logs

    return event;
  },

  /**
   * Reconstrói o log local de eventos de forma segura, removendo duplicidades
   * e ordenando de forma estritamente cronológica.
   */
  async rebuildEventLog(userId) {
    if (!userId) return;
    try {
      console.log(`[eventStore] Iniciando rebuild seguro do log de eventos para: ${userId}`);
      const allEvents = await localDB.getAll('events');
      
      // Filtra e deduplica em memória por ID único
      const userEvents = allEvents.filter(e => e.user_id === userId);
      const uniqueMap = new Map();
      userEvents.forEach(e => {
        if (e.id) {
          uniqueMap.set(e.id, e);
        }
      });

      // Ordena cronologicamente
      const sortedEvents = Array.from(uniqueMap.values()).sort((a, b) => 
        new Date(a.created_at || 0) - new Date(b.created_at || 0)
      );

      // Limpa os registros do IndexedDB e reinserte de forma ordenada
      await localDB.clear('events');
      
      const normalized = sortedEvents.map((e, idx) => ({
        ...e,
        event_version: e.event_version || 1,
        // Garante timestamps válidos e sequenciais
        created_at: e.created_at || new Date(Date.now() - (sortedEvents.length - idx) * 1000).toISOString()
      }));

      await localDB.putMany('events', normalized);
      console.log(`[eventStore] Rebuild concluído! ${normalized.length} eventos reconstruídos com sucesso.`);
    } catch (err) {
      console.error('[eventStore] Erro durante o rebuildEventLog:', err);
    }
  },

  /**
   * Recupera todos os eventos de um usuário ordenados cronologicamente.
   *
   * @param {string} userId
   * @returns {Promise<Array>} Lista de eventos ordenada por data
   */
  async getEventsForUser(userId) {
    if (!userId) return [];
    try {
      const allEvents = await localDB.getAll('events');
      // Filtra e deduplica localmente na leitura para segurança extra
      const seen = new Set();
      const userEvents = [];
      
      for (const e of allEvents) {
        if (e.user_id === userId && e.id && !seen.has(e.id)) {
          seen.add(e.id);
          userEvents.push(e);
        }
      }

      return userEvents.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } catch (err) {
      console.warn('[eventStore] Erro ao recuperar eventos locais:', err.message);
      return [];
    }
  },

  /**
   * Limpa todos os eventos locais do banco.
   */
  async clearAll() {
    await localDB.clear('events');
  }
};
