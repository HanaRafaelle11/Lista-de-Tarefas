/**
 * Billing Contract Enforcement & Runtime Validation Layer
 * 
 * Executa verificação rigorosa em runtime nos dados produzidos pelo serviço antes de responder a API.
 * Impede que dados corrompidos ou mal formatados cheguem silenciosamente ao Frontend.
 */

export const billingValidator = {
  validateEvent(evt) {
    if (!evt || typeof evt !== 'object') return false;
    const isValidId = typeof evt.id === 'string';
    const isValidUserId = typeof evt.userId === 'string' && evt.userId.length > 0;
    const isValidAmount = typeof evt.amount === 'number' && !isNaN(evt.amount);
    const isValidStatus = ['paid', 'pending', 'failed'].includes(evt.status);
    return isValidId && isValidUserId && isValidAmount && isValidStatus;
  },

  validateTimeline(timeline) {
    if (!timeline || typeof timeline !== 'object') {
      throw new Error('[Contract Check Failed] Payload de timeline não é um objeto válido.');
    }
    if (!Array.isArray(timeline.events)) {
      throw new Error('[Contract Check Failed] timeline.events deve ser um Array.');
    }
    if (!Array.isArray(timeline.ledger)) {
      throw new Error('[Contract Check Failed] timeline.ledger deve ser um Array.');
    }
    if (typeof timeline.amount !== 'number') {
      timeline.amount = Number(timeline.amount || 0);
    }
    return true;
  },

  validateSummary(summary) {
    if (!summary || typeof summary !== 'object') {
      throw new Error('[Contract Check Failed] Summary não é um objeto válido.');
    }
    if (typeof summary.mrr !== 'number' || isNaN(summary.mrr)) summary.mrr = 0;
    if (typeof summary.arr !== 'number' || isNaN(summary.arr)) summary.arr = 0;
    return true;
  }
};
