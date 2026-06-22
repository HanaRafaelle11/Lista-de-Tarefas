import { supabaseAdmin } from '../lib/supabase.js';
import { BillingLogger } from './billing-tracer.js';

export const EventOrderingEngine = {
  /**
   * Evaluates if the incoming event is out of order.
   * If the event's external timestamp is older than or equal to the last time
   * the local subscription was updated, the event is out of order and should be ignored.
   * 
   * @param {string} userId - User identifier
   * @param {string|Date|number} eventTimestamp - The timestamp of the event (date_last_updated, date_approved, etc.)
   * @returns {Promise<boolean>} True if the event is out of order and should be ignored
   */
  async isEventOutOfOrder(userId, eventTimestamp) {
    if (!userId) return false;
    if (!eventTimestamp) return false;

    const parsedEventTime = new Date(eventTimestamp).getTime();
    if (isNaN(parsedEventTime)) {
      BillingLogger.warn('event_ordering_invalid_timestamp', null, null, { userId, eventTimestamp });
      return false;
    }

    try {
      const { data: subscription, error } = await supabaseAdmin
        .from('subscriptions')
        .select('updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!subscription || !subscription.updated_at) {
        return false;
      }

      const localUpdatedTime = new Date(subscription.updated_at).getTime();

      if (parsedEventTime <= localUpdatedTime) {
        BillingLogger.info('event_ordering_out_of_order_detected', null, null, {
          userId,
          eventTimestamp: new Date(parsedEventTime).toISOString(),
          subscriptionUpdatedAt: new Date(localUpdatedTime).toISOString(),
          decision: 'ignore'
        });
        return true;
      }

      return false;
    } catch (err) {
      BillingLogger.error('event_ordering_check_error', null, null, err, { userId });
      return false;
    }
  }
};
