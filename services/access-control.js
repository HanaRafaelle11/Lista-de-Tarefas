import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Access Control Service
 * Single authority determining premium access based strictly on subscription status.
 */
export const AccessControl = {
  /**
   * Evaluates if a user has premium access.
   * Access is only granted if subscription.status === 'active' and period is not expired.
   * 
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} { isPro: boolean, reason: string }
   */
  async evaluateAccess(userId) {
    if (!userId) {
      return { isPro: false, reason: 'INVALID' };
    }

    try {
      const { data: subscription, error } = await supabaseAdmin
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error(`[AccessControl] Erro ao buscar assinatura para user ${userId}:`, error.message);
        return { isPro: false, reason: 'INVALID', error: error.message };
      }

      if (!subscription) {
        return { isPro: false, reason: 'FREE' };
      }

      const status = (subscription.status || 'free').toLowerCase();

      // Rule: premium only exists if status === active
      if (status !== 'active') {
        return { isPro: false, reason: status.toUpperCase() };
      }

      // Period expiration safety check
      const now = new Date();
      const expiresAt = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
      if (expiresAt && expiresAt < now) {
        return { isPro: false, reason: 'EXPIRED' };
      }

      return { isPro: true, reason: 'ACTIVE' };
    } catch (err) {
      console.error(`[AccessControl] Erro crítico no evaluateAccess para user ${userId}:`, err);
      return { isPro: false, reason: 'INVALID', error: err.message };
    }
  }
};
