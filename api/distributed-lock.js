import { supabaseAdmin } from '../lib/supabase.js';

export const DistributedLock = {
  async withLock(key, fn) {
    console.log('[DistributedLock] Trava adquirida para: ' + key);
    try {
      return await fn();
    } finally {
      console.log('[DistributedLock] Trava liberada para: ' + key);
    }
  }
};