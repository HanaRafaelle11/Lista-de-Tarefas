import { BillingLogger } from './billing-tracer.js';

export const RetryEngine = {
  /**
   * Executes an async operation with exponential backoff and randomized jitter.
   * If all retries fail, executes the fallback function or throws the error.
   * 
   * @param {Function} fn - The async operation to perform
   * @param {Object} options - Configuration options
   * @param {number} options.maxRetries - Maximum retry count (default 3)
   * @param {number} options.initialDelay - Initial delay in ms (default 100)
   * @param {number} options.factor - Exponential backoff multiplier factor (default 2)
   * @param {number} options.jitter - Randomized jitter factor between 0 and 1 (default 0.25)
   * @param {Function} options.fallback - Optional fallback function when retries fail
   * @param {string} options.operationName - Name of operation for logging
   * @param {string} options.paymentId - Payment ID associated with context
   */
  async execute(fn, options = {}) {
    const maxRetries = options.maxRetries ?? 3;
    const initialDelay = options.initialDelay ?? 50; // Use small defaults for snappy test executions
    const factor = options.factor ?? 2;
    const jitter = options.jitter ?? 0.25;
    const operationName = options.operationName || 'unnamed_operation';
    const paymentId = options.paymentId || null;
    const fallback = options.fallback || null;

    let attempt = 0;
    
    while (true) {
      try {
        return await fn();
      } catch (error) {
        attempt++;
        if (attempt > maxRetries) {
          BillingLogger.error(`${operationName}_all_retries_failed`, paymentId, null, error, {
            attempt,
            maxRetries
          });

          if (fallback) {
            BillingLogger.info(`${operationName}_executing_fallback`, paymentId, null, {
              reason: error.message
            });
            return await fallback(error);
          }
          throw error;
        }

        const backoff = initialDelay * Math.pow(factor, attempt - 1);
        const jitterVal = (Math.random() * 2 - 1) * jitter * backoff;
        const sleepTime = Math.max(10, Math.round(backoff + jitterVal));

        BillingLogger.warn(`${operationName}_retry_pending`, paymentId, null, {
          attempt,
          maxRetries,
          nextRetryInMs: sleepTime,
          error: error.message
        });

        await new Promise(resolve => setTimeout(resolve, sleepTime));
      }
    }
  }
};
