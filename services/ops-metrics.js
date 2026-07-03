/**
 * OpsMetrics — Singleton in-memory de contadores de observabilidade.
 * 
 * Leve, sem DB writes, stateless entre deploys.
 * Usado para expor métricas operacionais via endpoints /api/system/*.
 * 
 * NÃO persiste dados. NÃO altera lógica de negócio.
 */

const _startedAt = new Date().toISOString();

const _counters = {
  // Webhook
  'webhook.received': 0,
  'webhook.idempotent_hits': 0,
  'webhook.duplicates_detected': 0,
  'webhook.processed': 0,
  'webhook.errors': 0,

  // Lock
  'lock.attempts': 0,
  'lock.acquired': 0,
  'lock.failed': 0,
  'lock.timeouts': 0,
  'lock.total_wait_ms': 0,
  'lock.max_wait_ms': 0,

  // Replay
  'replay.runs': 0,
};

const _replay = {
  last_started_at: null,
  last_completed_at: null,
  last_duration_ms: null,
  last_events_count: null,
  last_status: null,
};

let _totalProjectionDelayMs = 0;
let _projectionCount = 0;

export const OpsMetrics = {
  /**
   * Registra o atraso de uma projeção de evento.
   * @param {number} delayMs 
   */
  recordProjectionDelay(delayMs) {
    _totalProjectionDelayMs += delayMs;
    _projectionCount++;
  },

  /**
   * Retorna o atraso médio de projeção.
   */
  getAvgProjectionDelay() {
    return _projectionCount > 0 ? Math.round(_totalProjectionDelayMs / _projectionCount) : 0;
  },
  /**
   * Incrementa um contador por nome.
   * @param {string} key - Nome do contador (ex: 'webhook.idempotent_hits')
   * @param {number} [value=1] - Valor a incrementar
   */
  increment(key, value = 1) {
    if (key in _counters) {
      _counters[key] += value;
    }
  },

  /**
   * Atualiza o valor máximo de um contador (usado para max_wait_ms).
   * @param {string} key - Nome do contador
   * @param {number} value - Valor candidato a máximo
   */
  max(key, value) {
    if (key in _counters) {
      if (value > _counters[key]) {
        _counters[key] = value;
      }
    }
  },

  /**
   * Retorna todos os contadores como snapshot.
   */
  getCounters() {
    return { ..._counters };
  },

  /**
   * Retorna métricas de webhook formatadas.
   */
  getWebhookMetrics() {
    return {
      received: _counters['webhook.received'],
      idempotent_hits: _counters['webhook.idempotent_hits'],
      duplicates_detected: _counters['webhook.duplicates_detected'],
      processed: _counters['webhook.processed'],
      errors: _counters['webhook.errors'],
      since: _startedAt,
    };
  },

  /**
   * Retorna métricas de idempotência formatadas.
   */
  getIdempotencyMetrics() {
    return {
      webhook_duplicates_detected: _counters['webhook.duplicates_detected'],
      events_rejected_by_idempotency: _counters['webhook.idempotent_hits'],
      replay_already_applied: 0, // reserved for future use
      since: _startedAt,
    };
  },

  /**
   * Retorna métricas de lock formatadas.
   */
  getLockMetrics() {
    const attempts = _counters['lock.attempts'];
    const totalWait = _counters['lock.total_wait_ms'];
    return {
      total_attempts: attempts,
      total_acquired: _counters['lock.acquired'],
      total_failed: _counters['lock.failed'],
      total_timeouts: _counters['lock.timeouts'],
      avg_wait_ms: attempts > 0 ? Math.round(totalWait / attempts) : 0,
      max_wait_ms: _counters['lock.max_wait_ms'],
      since: _startedAt,
    };
  },

  /**
   * Registra início de replay.
   */
  replayStarted() {
    _replay.last_started_at = new Date().toISOString();
    _replay.last_status = 'running';
    _counters['replay.runs']++;
  },

  /**
   * Registra conclusão de replay.
   * @param {number} eventsCount - Número de eventos reprojetados
   * @param {boolean} success - Se o replay foi bem-sucedido
   */
  replayCompleted(eventsCount, success) {
    _replay.last_completed_at = new Date().toISOString();
    _replay.last_events_count = eventsCount;
    _replay.last_status = success ? 'completed' : 'failed';
    if (_replay.last_started_at) {
      _replay.last_duration_ms = new Date(_replay.last_completed_at).getTime() - new Date(_replay.last_started_at).getTime();
    }
  },

  /**
   * Retorna estado do último replay.
   */
  getReplayMetrics() {
    return { ..._replay, total_runs: _counters['replay.runs'] };
  },

  /**
   * Retorna timestamp de quando o processo iniciou.
   */
  getStartedAt() {
    return _startedAt;
  },
};
