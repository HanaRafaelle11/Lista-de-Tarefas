/**
 * Payment State Machine
 * Centralized authority for payment status transitions.
 */
export const PaymentStateMachine = {
  /**
   * Validates whether a state transition is allowed.
   */
  isValidTransition(currentStatus, newStatus) {
    if (!currentStatus) return true; // Initial creation is always allowed
    if (currentStatus === newStatus) return false; // No transition needed if same status

    // Terminal statuses (except approved which can only transition to reconciled)
    const terminalStates = ['rejected', 'cancelled', 'refunded', 'reconciled'];
    if (terminalStates.includes(currentStatus)) {
      return false;
    }

    // approved is terminal EXCEPT for transition to reconciled
    if (currentStatus === 'approved') {
      return newStatus === 'reconciled';
    }

    // reconciled can only occur after approved or pending
    if (newStatus === 'reconciled') {
      return ['approved', 'pending'].includes(currentStatus);
    }

    // Transitions from created
    if (currentStatus === 'created') {
      return ['pending', 'in_process', 'approved', 'rejected', 'cancelled', 'refunded'].includes(newStatus);
    }

    // Transitions from pending or in_process
    if (['pending', 'in_process'].includes(currentStatus)) {
      return ['approved', 'rejected', 'cancelled', 'refunded', 'reconciled'].includes(newStatus);
    }

    return false;
  },

  /**
   * Evaluates state transition, throws error if invalid.
   */
  transition(currentStatus, newStatus, context = {}) {
    if (!this.isValidTransition(currentStatus, newStatus)) {
      throw new Error(`[PaymentStateMachine] Transição de estado inválida de '${currentStatus}' para '${newStatus}'`);
    }
    return newStatus;
  }
};
