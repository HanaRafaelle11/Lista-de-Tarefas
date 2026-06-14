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

    const event = {
      id: generateId(),
      user_id: userId,
      event_type: eventType,
      metadata: metadata || {},
      created_at: new Date().toISOString()
    };

    // 1. Salva no IndexedDB
    await localDB.put('events', event);

    // 2. Dispara evento no barramento síncrono local
    eventEmitter.emit(eventType, event);
    eventEmitter.emit('*', event); // Coringa para escuta global de replays/logs

    return event;
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
      return allEvents
        .filter(e => e.user_id === userId)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
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
