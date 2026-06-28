/**
 * RUNTIME PROTECTION LAYER (RPL) - Rate Limiter Module
 * Algoritmo: Sliding Window Token Bucket em memória com suporte a identificadores por IP/User.
 */

const requestStore = new Map();

// Configurações padrão
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minuto
const DEFAULT_MAX_REQUESTS = 30;     // 30 requisições por minuto por identificador

export const RateLimiter = {
  /**
   * Verifica se uma requisição pode prosseguir ou se excede o limite.
   * @param {string} identifier - IP ou ID de usuário.
   * @param {object} options - { maxRequests, windowMs }
   * @returns {object} { allowed: boolean, remaining: number, resetMs: number }
   */
  check(identifier, options = {}) {
    if (!identifier) {
      return { allowed: true, remaining: 999, resetMs: 0 };
    }

    const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
    const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
    const now = Date.now();

    let record = requestStore.get(identifier);
    if (!record || (now - record.startTime) > windowMs) {
      record = {
        count: 1,
        startTime: now
      };
      requestStore.set(identifier, record);
      return { allowed: true, remaining: maxRequests - 1, resetMs: windowMs };
    }

    if (record.count >= maxRequests) {
      const resetMs = windowMs - (now - record.startTime);
      return { allowed: false, remaining: 0, resetMs };
    }

    record.count += 1;
    const remaining = maxRequests - record.count;
    const resetMs = windowMs - (now - record.startTime);
    return { allowed: true, remaining, resetMs };
  },

  /**
   * Limpa registros expirados em memória periodicamente (Garbage Collection interno).
   */
  cleanup(windowMs = DEFAULT_WINDOW_MS) {
    const now = Date.now();
    for (const [key, record] of requestStore.entries()) {
      if (now - record.startTime > windowMs) {
        requestStore.delete(key);
      }
    }
  }
};

// Auto-cleanup a cada 2 minutos
setInterval(() => RateLimiter.cleanup(), 2 * 60 * 1000);
