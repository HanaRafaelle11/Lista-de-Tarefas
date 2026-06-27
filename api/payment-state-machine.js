// Máquina de estados dos pagamentos do Mercado Pago
export const PaymentStateMachine = {
  transitions: {
    'created': ['approved', 'pending', 'rejected', 'cancelled', 'in_process', 'refunded'],
    'pending': ['approved', 'rejected', 'cancelled', 'in_process', 'refunded', 'reconciled'],
    'in_process': ['approved', 'rejected', 'cancelled', 'refunded'],
    'approved': ['refunded', 'charged_back', 'reconciled'],
    'rejected': [],
    'cancelled': [],
    'refunded': [],
    'reconciled': []
  },
  isValidTransition(current, next) {
    if (!current) return true;
    if (current === next) return false;
    const allowed = this.transitions[current] || [];
    return allowed.includes(next);
  },
  transition(current, next) {
    if (!this.isValidTransition(current, next)) {
      console.warn('[PaymentStateMachine] Transição inválida de ' + current + ' para ' + next);
      throw new Error(`[PaymentStateMachine] Transição de estado inválida de '${current}' para '${next}'`);
    }
    return next;
  }
};