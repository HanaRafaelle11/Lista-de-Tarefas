/**
 * RUNTIME PROTECTION LAYER (RPL) - Backpressure Control Module
 * Monitora a carga do sistema e ajusta o comportamento em tempo real quando sob estresse.
 */

import { WebhookQueue } from './webhook-queue.js';

const QUEUE_HIGH_WATERMARK = 50; // Se a fila passar de 50 itens, ativa backpressure leve
const QUEUE_CRITICAL_WATERMARK = 200; // Se passar de 200 itens, ativa backpressure alto

export const BackpressureControl = {
  /**
   * Avalia a saúde e a pressão operacional do sistema.
   * @returns {object} { level: 'NORMAL'|'HIGH'|'CRITICAL', throttleMs: number, shedNonCritical: boolean }
   */
  assess() {
    const queueDepth = WebhookQueue.getDepth();

    if (queueDepth >= QUEUE_CRITICAL_WATERMARK) {
      console.warn(`[BACKPRESSURE CONTROL] Nível CRÍTICO atingido! Profundidade da fila: ${queueDepth}`);
      return {
        level: 'CRITICAL',
        throttleMs: 500,
        shedNonCritical: true,
        queueDepth
      };
    }

    if (queueDepth >= QUEUE_HIGH_WATERMARK) {
      console.warn(`[BACKPRESSURE CONTROL] Nível ALTO atingido! Profundidade da fila: ${queueDepth}`);
      return {
        level: 'HIGH',
        throttleMs: 100,
        shedNonCritical: true,
        queueDepth
      };
    }

    return {
      level: 'NORMAL',
      throttleMs: 0,
      shedNonCritical: false,
      queueDepth
    };
  }
};
