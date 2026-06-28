/**
 * RUNTIME PROTECTION LAYER (RPL) - Webhook Queue & Buffer Module
 * Desacopla o recebimento de webhooks do processamento síncrono no banco de dados.
 */

import { supabaseAdmin } from '../../../lib/supabase.js';

const memoryQueue = [];
let isWorkerRunning = false;

export const WebhookQueue = {
  /**
   * Enfileira um webhook recebido para processamento assíncrono.
   * @param {object} payload - Dados recebidos do webhook.
   * @returns {object} { queued: true, queueId: string }
   */
  async enqueue(payload) {
    const queueId = 'wq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const item = {
      id: queueId,
      payload,
      receivedAt: new Date().toISOString(),
      attempts: 0
    };

    memoryQueue.push(item);
    
    // Dispara o worker de processamento assíncrono (non-blocking)
    setImmediate(() => WebhookQueue.processNext());

    return { queued: true, queueId };
  },

  /**
   * Retorna o tamanho atual da fila (profundidade).
   */
  getDepth() {
    return memoryQueue.length;
  },

  /**
   * Worker interno que processa itens da fila.
   */
  async processNext() {
    if (isWorkerRunning || memoryQueue.length === 0) return;
    isWorkerRunning = true;

    try {
      while (memoryQueue.length > 0) {
        const item = memoryQueue.shift();
        item.attempts += 1;

        try {
          const { BillingEngine } = await import('../../../lib/billing/engine.js');
          const body = item.payload || {};
          const event = body.event || body.type;
          const payment = body.payment || body.data || {};
          const paymentId = payment.id || body.id;
          const customerId = payment.customer || body.customer;
          const billingType = payment.billingType || body.billingType || 'PIX';
          const value = payment.value || body.value || 0;

          // Processamento idempotente no BillingEngine
          if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_APPROVED') {
            if (paymentId && customerId) {
              await BillingEngine.processPaymentSuccess({
                userId: customerId,
                paymentId,
                value,
                billingType
              });
            }
          }
        } catch (procErr) {
          console.error(`[WEBHOOK QUEUE WORKER ERROR] Falha ao processar item ${item.id}:`, procErr.message);
          // Se falhar e tiver menos de 3 tentativas, reenfileira com delay
          if (item.attempts < 3) {
            setTimeout(() => memoryQueue.push(item), 1000 * item.attempts);
          }
        }
      }
    } finally {
      isWorkerRunning = false;
    }
  }
};
