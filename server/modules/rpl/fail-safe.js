/**
 * RUNTIME PROTECTION LAYER (RPL) - Fail-Safe Mode Module
 * Garante que quando a infraestrutura ou banco degrada, o sistema entra em modo de segurança:
 * 1. Leitura de billing_events e billing_ledger permanece imutável e ativa.
 * 2. Operações não-críticas de escrita são desabilitadas temporariamente.
 * 3. Impedimento absoluto de corrupção de dados financeiros.
 */

let isFailSafeActive = false;
let failSafeReason = '';

export const FailSafeMode = {
  /**
   * Ativa o Modo Fail-Safe.
   * @param {string} reason - Motivo da ativação (ex: DB degradation, high error rate).
   */
  activate(reason = 'Degradação de infraestrutura detectada') {
    if (!isFailSafeActive) {
      isFailSafeActive = true;
      failSafeReason = reason;
      console.error(`[FAIL-SAFE MODE ACTIVATED] Sistema em modo de segurança! Motivo: ${reason}`);
    }
  },

  /**
   * Desativa o Modo Fail-Safe quando o sistema se recupera.
   */
  deactivate() {
    if (isFailSafeActive) {
      isFailSafeActive = false;
      failSafeReason = '';
      console.log(`[FAIL-SAFE MODE DEACTIVATED] Sistema retornou à operação normal.`);
    }
  },

  /**
   * Retorna se o Fail-Safe Mode está ativo.
   */
  isActive() {
    return isFailSafeActive;
  },

  /**
   * Retorna o status detalhado.
   */
  getStatus() {
    return {
      active: isFailSafeActive,
      reason: failSafeReason,
      timestamp: new Date().toISOString()
    };
  }
};
