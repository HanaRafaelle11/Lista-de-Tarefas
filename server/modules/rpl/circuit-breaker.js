/**
 * RUNTIME PROTECTION LAYER (RPL) - Circuit Breaker Module
 * Proteção anti-colapso contra falhas em cascata no banco de dados e APIs de gateways.
 */

export const CircuitState = {
  CLOSED: 'CLOSED',       // Operação normal
  OPEN: 'OPEN',           // Bloqueado (fast-fail)
  HALF_OPEN: 'HALF_OPEN'  // Teste de recuperação
};

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 0.3; // 30% de taxa de erro
    this.minimumRequests = options.minimumRequests || 5;     // Mínimo de reqs para calcular taxa
    this.cooldownMs = options.cooldownMs || 30 * 1000;       // 30 segundos em OPEN
    this.windowMs = options.windowMs || 60 * 1000;           // Janela deslizante de 1 minuto

    this.state = CircuitState.CLOSED;
    this.requests = [];
    this.lastStateChange = Date.now();
  }

  /**
   * Executa uma função protegida pelo Circuit Breaker.
   * @param {Function} fn - Função assíncrona a ser executada.
   * @param {Function} fallbackFn - Função alternativa caso o circuito esteja OPEN ou ocorra erro.
   */
  async execute(fn, fallbackFn = null) {
    this._updateState();

    if (this.state === CircuitState.OPEN) {
      console.warn(`[CIRCUIT BREAKER: ${this.name}] OPEN. Executando fast-fail / fallback.`);
      if (fallbackFn) return await fallbackFn(new Error('Circuit Breaker IS OPEN'));
      throw new Error(`[CircuitBreaker] Circuito '${this.name}' está ABERTO devido a falhas recentes.`);
    }

    const startTime = Date.now();
    try {
      const result = await fn();
      this._recordSuccess(startTime);
      if (this.state === CircuitState.HALF_OPEN) {
        console.log(`[CIRCUIT BREAKER: ${this.name}] Recuperação bem sucedida. Alterando para CLOSED.`);
        this.state = CircuitState.CLOSED;
        this.lastStateChange = Date.now();
      }
      return result;
    } catch (err) {
      this._recordFailure(startTime, err);
      if (this.state === CircuitState.HALF_OPEN) {
        console.warn(`[CIRCUIT BREAKER: ${this.name}] Falha durante HALF_OPEN. Retornando para OPEN.`);
        this.state = CircuitState.OPEN;
        this.lastStateChange = Date.now();
      }
      if (fallbackFn) return await fallbackFn(err);
      throw err;
    }
  }

  _updateState() {
    const now = Date.now();
    if (this.state === CircuitState.OPEN && (now - this.lastStateChange) > this.cooldownMs) {
      console.log(`[CIRCUIT BREAKER: ${this.name}] Cooldown expirado. Transicionando para HALF_OPEN.`);
      this.state = CircuitState.HALF_OPEN;
      this.lastStateChange = now;
    }
  }

  _recordSuccess(startTime) {
    this._cleanWindow();
    this.requests.push({ success: true, timestamp: Date.now() });
  }

  _recordFailure(startTime, error) {
    this._cleanWindow();
    this.requests.push({ success: false, timestamp: Date.now(), error: error?.message });
    this._checkThreshold();
  }

  _cleanWindow() {
    const now = Date.now();
    this.requests = this.requests.filter(r => (now - r.timestamp) <= this.windowMs);
  }

  _checkThreshold() {
    if (this.state !== CircuitState.CLOSED) return;

    if (this.requests.length >= this.minimumRequests) {
      const failures = this.requests.filter(r => !r.success).length;
      const errorRate = failures / this.requests.length;

      if (errorRate >= this.failureThreshold) {
        console.error(`[CIRCUIT BREAKER: ${this.name}] Taxa de erro (${(errorRate * 100).toFixed(1)}%) superou o limite de 30%. ABRINDO CIRCUITO.`);
        this.state = CircuitState.OPEN;
        this.lastStateChange = Date.now();
      }
    }
  }

  getStatus() {
    this._cleanWindow();
    const failures = this.requests.filter(r => !r.success).length;
    const total = this.requests.length;
    return {
      name: this.name,
      state: this.state,
      totalRequests: total,
      errorRate: total > 0 ? (failures / total) : 0,
      lastStateChange: new Date(this.lastStateChange).toISOString()
    };
  }
}

// Registry global de breakers por serviço
const breakerRegistry = new Map();

export const CircuitBreakerFactory = {
  getBreaker(name, options = {}) {
    if (!breakerRegistry.has(name)) {
      breakerRegistry.set(name, new CircuitBreaker(name, options));
    }
    return breakerRegistry.get(name);
  }
};
