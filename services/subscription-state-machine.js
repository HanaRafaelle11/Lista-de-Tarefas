/**
 * Subscription State Machine
 * Centralized authority for subscription state transitions.
 */
export const SubscriptionStateMachine = {
  /**
   * Validates whether a subscription status transition is allowed.
   */
  isValidTransition(currentStatus, newStatus) {
    if (!currentStatus) return true; // Initial creation is always allowed
    if (currentStatus === newStatus) return true; // No transition needed if same status

    // normalized inputs to lowercase
    const current = currentStatus.toLowerCase();
    const next = newStatus.toLowerCase();

    // Valid states: trialing, active, past_due, canceled, expired
    const validStates = ['trialing', 'active', 'past_due', 'canceled', 'expired'];
    if (!validStates.includes(current) || !validStates.includes(next)) {
      return false;
    }

    // Transitions from trialing
    if (current === 'trialing') {
      return ['active', 'expired', 'canceled'].includes(next);
    }

    // Transitions from active
    if (current === 'active') {
      return ['past_due', 'canceled', 'expired'].includes(next);
    }

    // Transitions from past_due
    if (current === 'past_due') {
      return ['active', 'expired', 'canceled'].includes(next);
    }

    // Transitions from canceled
    if (current === 'canceled') {
      return ['expired', 'active'].includes(next);
    }

    // Transitions from expired
    if (current === 'expired') {
      return ['active', 'trialing'].includes(next);
    }

    return false;
  },

  /**
   * Transitions from currentStatus to newStatus, throws error on invalid transitions.
   */
  transition(currentStatus, newStatus) {
    if (!this.isValidTransition(currentStatus, newStatus)) {
      throw new Error(`[SubscriptionStateMachine] Transição de estado inválida de '${currentStatus}' para '${newStatus}'`);
    }
    return newStatus.toLowerCase();
  }
};
