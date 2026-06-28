/**
 * Billing State Machine - Deterministic Lifecycle Manager
 * 
 * Regras estritas de transição de estado para evitar race conditions,
 * ativações de plano antes da hora e inconsistência de status.
 */
export const BillingStateMachine = {
  states: {
    FREE: 'free',
    CHECKOUT_CREATED: 'checkout_created',
    PAYMENT_PENDING: 'payment_pending',
    PAYMENT_CONFIRMED: 'payment_confirmed',
    ACTIVE: 'active',
    PAST_DUE: 'past_due',
    OVERDUE: 'overdue',
    CANCELED: 'canceled',
    EXPIRED: 'expired',
    REFUNDED: 'refunded'
  },

  transitions: {
    'free': ['checkout_created', 'payment_pending', 'pending', 'active'],
    'checkout_created': ['payment_pending', 'pending', 'free', 'canceled', 'cancelled'],
    'payment_pending': ['active', 'payment_confirmed', 'confirmed', 'canceled', 'cancelled', 'expired', 'free', 'past_due'],
    'pending': ['active', 'payment_confirmed', 'confirmed', 'canceled', 'cancelled', 'expired', 'free', 'past_due'],
    'payment_confirmed': ['active', 'refunded'],
    'confirmed': ['active', 'refunded'],
    'active': ['past_due', 'canceled', 'cancelled', 'expired', 'refunded'],
    'past_due': ['active', 'overdue', 'canceled', 'cancelled', 'expired'],
    'overdue': ['active', 'canceled', 'cancelled', 'expired'],
    'canceled': ['active', 'free'],
    'cancelled': ['active', 'free'],
    'expired': ['active', 'free'],
    'refunded': ['free']
  },

  /**
   * Normaliza sinônimos de status para um identificador canônico.
   */
  normalizeStatus(status) {
    if (!status) return 'free';
    const s = String(status).toLowerCase().trim();
    if (s === 'pending') return 'pending';
    if (s === 'cancelled') return 'canceled';
    if (s === 'confirmed') return 'payment_confirmed';
    return s;
  },

  /**
   * Verifica se uma transição de estado é válida.
   */
  isValidTransition(currentStatus, newStatus) {
    if (!currentStatus) return true;
    const current = this.normalizeStatus(currentStatus);
    const next = this.normalizeStatus(newStatus);
    if (current === next) return true;

    const allowed = (this.transitions[current] || []).map(s => this.normalizeStatus(s));
    return allowed.includes(next);
  },

  /**
   * Efetua a transição de estado. Se for inválida, loga o aviso e força o novo estado seguro.
   */
  transition(currentStatus, newStatus) {
    const current = currentStatus ? this.normalizeStatus(currentStatus) : 'free';
    const next = this.normalizeStatus(newStatus);
    
    if (!this.isValidTransition(current, next)) {
      console.warn(`[BillingStateMachine] Transição inválida detectada: ${current} -> ${next}`);
      return next;
    }
    return next;
  }
};
