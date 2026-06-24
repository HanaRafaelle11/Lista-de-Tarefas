// Máquina de estados dos pagamentos do Mercado Pago
export const PaymentStateMachine = {
  transitions: {
    'created': ['approved', 'pending', 'rejected', 'cancelled', 'in_process'],
    'pending': ['approved', 'rejected', 'cancelled', 'in_process'],
    'in_process': ['approved', 'rejected', 'cancelled'],
    'approved': ['refunded', 'charged_back'],
    'rejected': [],
    'cancelled': []
  },
  transition(current, next) {
    const allowed = this.transitions[current] || [];
    if (allowed.includes(next) || current === next) return next;
    console.warn(\[PaymentStateMachine] Transição inválida de \ para \\);
    return next;
  }
};
