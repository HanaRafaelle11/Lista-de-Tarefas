import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { supabaseAdmin } from '../lib/supabase.js';
import { BillingLogger } from './billing-tracer.js';
import { OpsMetrics } from './ops-metrics.js';

const lockStorage = new AsyncLocalStorage();

export const DistributedLock = {
  /**
   * Executes an async operation with re-entrant lock behavior.
   */
  async withLock(key, fn, options = {}) {
    const store = lockStorage.getStore() || new Map();
    if (store.has(key)) {
      BillingLogger.info('lock_reentrant_access', null, null, { key });
      return await fn();
    }

    const owner = await this.acquire(key, options);
    const newStore = new Map(store);
    newStore.set(key, owner);

    return await lockStorage.run(newStore, async () => {
      try {
        return await fn();
      } finally {
        await this.release(key, owner);
      }
    });
  },
  /**
   * Attempts to acquire a distributed lock.
   * If lock cannot be acquired immediately, retries with exponential backoff.
   * 
   * @param {string} key - Lock identifier (e.g. 'subscription:user_id')
   * @param {Object} options - Configuration options
   * @param {number} options.lockTimeoutMs - Lock duration in ms (default 5000)
   * @param {number} options.acquireTimeoutMs - Maximum wait time to acquire lock in ms (default 5000)
   * @param {number} options.initialDelayMs - Backoff initial delay in ms (default 50)
   */
  async acquire(key, options = {}) {
    const lockTimeoutMs = options.lockTimeoutMs ?? 5000;
    const acquireTimeoutMs = options.acquireTimeoutMs ?? 5000;
    const initialDelayMs = options.initialDelayMs ?? 200;

    const owner = crypto.randomUUID();
    const startTime = Date.now();
    let attempt = 0;
    let isFirstAttempt = true;

    BillingLogger.info('lock_acquire_attempt', null, null, { key, owner });
    OpsMetrics.increment('lock.attempts');

    // Clean up expired locks exactly once before entering the polling loop
    try {
      const now = new Date();
      await supabaseAdmin
        .from('billing_locks')
        .delete()
        .eq('key', key)
        .lt('expires_at', now.toISOString());
    } catch (err) {
      BillingLogger.error('lock_cleanup_error', null, null, err, { key, owner });
    }

    while (true) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + lockTimeoutMs);

      try {
        // Then insert the lock
        const { error: insertErr } = await supabaseAdmin
          .from('billing_locks')
          .insert([{
            key,
            owner,
            expires_at: expiresAt.toISOString(),
            created_at: now.toISOString()
          }]);

        if (!insertErr) {
          const waitTime = Date.now() - startTime;
          OpsMetrics.increment('lock.acquired');
          OpsMetrics.increment('lock.total_wait_ms', waitTime);
          OpsMetrics.max('lock.max_wait_ms', waitTime);
          BillingLogger.info('lock_acquired', null, null, { key, owner, expires_at: expiresAt.toISOString() });
          return owner;
        }

        // If unique constraint violation, the lock is already held
        if (insertErr.code !== '23505') {
          OpsMetrics.increment('lock.failed');
          throw insertErr;
        }
      } catch (err) {
        BillingLogger.error('lock_acquire_error', null, null, err, { key, owner });
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= acquireTimeoutMs) {
        OpsMetrics.increment('lock.failed');
        OpsMetrics.increment('lock.timeouts');
        BillingLogger.warn('lock_acquire_timeout', null, null, { key, owner, elapsedMs: elapsed });
        throw new Error(`[DistributedLock] Timeout ao adquirir lock para chave '${key}' após ${elapsed}ms`);
      }

      attempt++;
      const backoff = initialDelayMs * Math.pow(1.5, attempt);
      const jitter = (Math.random() * 0.5 + 0.75) * backoff;
      const sleepTime = Math.round(jitter);

      await new Promise(resolve => setTimeout(resolve, sleepTime));
    }
  },

  /**
   * Releases a distributed lock if the caller is the owner.
   */
  async release(key, owner) {
    if (!key || !owner) {
      BillingLogger.warn('lock_release_invalid_args', null, null, { key, owner });
      return false;
    }

    try {
      const { error, count } = await supabaseAdmin
        .from('billing_locks')
        .delete({ count: 'exact' })
        .eq('key', key)
        .eq('owner', owner);

      if (error) {
        throw error;
      }

      if (count > 0) {
        BillingLogger.info('lock_released', null, null, { key, owner });
        return true;
      } else {
        BillingLogger.warn('lock_release_failed_not_owner', null, null, { key, owner });
        return false;
      }
    } catch (err) {
      BillingLogger.error('lock_release_exception', null, null, err, { key, owner });
      return false;
    }
  }
};
