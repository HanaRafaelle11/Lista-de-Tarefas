import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';

const asyncLocalStorage = new AsyncLocalStorage();

export const BillingTracer = {
  /**
   * Runs a callback within the context of a trace ID.
   */
  runWithTrace(traceId, callback) {
    const activeTraceId = traceId || crypto.randomUUID();
    return asyncLocalStorage.run(activeTraceId, callback);
  },

  /**
   * Retrieves the current trace ID from the async storage, or generates a new one.
   */
  getTraceId() {
    return asyncLocalStorage.getStore() || crypto.randomUUID();
  },

  /**
   * Persists a billing trace in the billing_traces table.
   */
  async recordTrace({ paymentId, userId, eventType, stateBefore, stateAfter, source, metadata = {} }) {
    const traceId = this.getTraceId();
    const timestamp = new Date().toISOString();

    try {
      const { error } = await supabaseAdmin
        .from('billing_traces')
        .insert([{
          trace_id: traceId,
          payment_id: paymentId ? String(paymentId) : null,
          user_id: userId ? String(userId) : null,
          event_type: eventType,
          state_before: stateBefore || null,
          state_after: stateAfter || null,
          source: source,
          timestamp,
          metadata
        }]);

      if (error) {
        BillingLogger.error('trace_record_failed', paymentId, null, error, { eventType, source });
      }
    } catch (err) {
      BillingLogger.error('trace_record_exception', paymentId, null, err, { eventType, source });
    }
  }
};

export const BillingLogger = {
  log(level, event, paymentId, subscriptionId, metadata = {}) {
    const traceId = BillingTracer.getTraceId();
    const logObj = {
      level,
      service: 'billing',
      event,
      payment_id: paymentId ? String(paymentId) : undefined,
      subscription_id: subscriptionId ? String(subscriptionId) : undefined,
      trace_id: traceId,
      timestamp: new Date().toISOString(),
      metadata
    };

    if (level === 'error') {
      console.error(JSON.stringify(logObj));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logObj));
    } else {
      console.log(JSON.stringify(logObj));
    }
  },

  info(event, paymentId, subscriptionId, metadata = {}) {
    this.log('info', event, paymentId, subscriptionId, metadata);
  },

  warn(event, paymentId, subscriptionId, metadata = {}) {
    this.log('warn', event, paymentId, subscriptionId, metadata);
  },

  error(event, paymentId, subscriptionId, error, metadata = {}) {
    const errMeta = {
      ...metadata,
      error_message: error?.message || String(error),
      error_stack: error?.stack
    };
    this.log('error', event, paymentId, subscriptionId, errMeta);
  }
};
