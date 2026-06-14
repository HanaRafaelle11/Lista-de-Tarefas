/**
 * eventEmitter.js — Barramento de Eventos síncrono Pub/Sub
 *
 * Permite que componentes e motores de regras se inscrevam para reagir
 * a eventos gerados pelo usuário de forma desacoplada.
 */

class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Se inscreve em um tipo de evento.
   *
   * @param {string} eventType - Nome do evento ou '*' para todos
   * @param {function} callback
   * @returns {function} Função para se desinscrever
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);

    return () => {
      const list = this.listeners.get(eventType);
      if (list) {
        list.delete(callback);
        if (list.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  /**
   * Dispara um evento para todos os ouvintes registrados.
   *
   * @param {string} eventType
   * @param {object} eventData
   */
  emit(eventType, eventData) {
    const list = this.listeners.get(eventType);
    if (list) {
      list.forEach(cb => {
        try {
          cb(eventData);
        } catch (err) {
          console.error(`[eventEmitter] Erro no listener de "${eventType}":`, err);
        }
      });
    }
  }

  /**
   * Limpa todos os ouvintes.
   */
  clear() {
    this.listeners.clear();
  }
}

export const eventEmitter = new EventEmitter();
