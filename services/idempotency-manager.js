import { supabaseAdmin } from '../lib/supabase.js';
import { BillingLogger } from './billing-tracer.js';

export const IdempotencyManager = {
  /**
   * Attempts to register and start processing an event.
   * Returns an object indicating status:
   * - { success: true }: Can proceed with processing.
   * - { success: false, duplicate: true, response: ... }: Already processed.
   * - { success: false, processing: true }: Under processing right now.
   */
  async startProcessing(paymentId, eventType) {
    if (!paymentId || !eventType) {
      throw new Error('[IdempotencyManager] paymentId and eventType are required');
    }

    const key = `${paymentId}:${eventType}`;

    try {
      const { data: record, error: fetchErr } = await supabaseAdmin
        .from('billing_idempotency')
        .select('*')
        .eq('key', key)
        .maybeSingle();

      if (fetchErr) {
        throw fetchErr;
      }

      if (record) {
        if (record.status === 'completed') {
          BillingLogger.info('idempotency_duplicate_ignored', paymentId, null, {
            key,
            status: record.status
          });
          return { success: false, duplicate: true, response: record.response };
        }
        if (record.status === 'processing') {
          // If it has been processing for more than 30 seconds, consider it timed out and let it retried
          const lastUpdate = new Date(record.updated_at).getTime();
          const elapsed = Date.now() - lastUpdate;
          if (elapsed < 30000) {
            BillingLogger.warn('idempotency_currently_processing', paymentId, null, {
              key,
              status: record.status
            });
            return { success: false, processing: true };
          }
        }
      }

      const now = new Date().toISOString();
      const { error: upsertErr } = await supabaseAdmin
        .from('billing_idempotency')
        .upsert({
          key,
          status: 'processing',
          response: {},
          updated_at: now
        }, { onConflict: 'key' });

      if (upsertErr) {
        throw upsertErr;
      }

      return { success: true };
    } catch (error) {
      BillingLogger.error('idempotency_start_failed', paymentId, null, error, { key });
      throw error;
    }
  },

  /**
   * Marks the idempotency key as successfully completed and stores the response payload.
   */
  async complete(paymentId, eventType, response = {}) {
    const key = `${paymentId}:${eventType}`;
    const now = new Date().toISOString();

    try {
      const { error } = await supabaseAdmin
        .from('billing_idempotency')
        .update({
          status: 'completed',
          response,
          updated_at: now
        })
        .eq('key', key);

      if (error) {
        throw error;
      }
      
      BillingLogger.info('idempotency_completed', paymentId, null, { key });
    } catch (error) {
      BillingLogger.error('idempotency_complete_failed', paymentId, null, error, { key });
    }
  },

  /**
   * Marks the idempotency key as failed so it can be retried later.
   */
  async fail(paymentId, eventType) {
    const key = `${paymentId}:${eventType}`;
    const now = new Date().toISOString();

    try {
      const { error } = await supabaseAdmin
        .from('billing_idempotency')
        .update({
          status: 'failed',
          updated_at: now
        })
        .eq('key', key);

      if (error) {
        throw error;
      }

      BillingLogger.info('idempotency_failed', paymentId, null, { key });
    } catch (error) {
      BillingLogger.error('idempotency_fail_failed', paymentId, null, error, { key });
    }
  }
};
