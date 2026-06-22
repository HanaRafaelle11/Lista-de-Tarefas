/**
 * Access Decision Engine (Fonte Absoluta de Verdade)
 * 
 * Este serviço é a única autoridade final que decide se um usuário
 * tem acesso premium ou não, baseado em seu perfil e regras estruturadas.
 */

export const AccessDecisionEngine = {
  /**
   * Avalia as colunas de plano e status de assinatura do perfil do usuário.
   * Retorna um veredito determinístico.
   * 
   * @param {Object} profile - Perfil do usuário contendo plano, assinatura_status e assinatura_expira_em
   * @returns {Object} { isPro: boolean, reason: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED' | 'REACTIVATION_PENDING' | 'TRIALING' | 'FREE' | 'INVALID' }
   */
  evaluateAccess(subscription) {
    if (!subscription) {
      return { isPro: false, reason: 'FREE' };
    }

    const status = (subscription.status || 'free').toUpperCase();
    const expiresAt = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
    const now = new Date();

    if (status === 'ACTIVE') {
      if (expiresAt && expiresAt < now) {
        return { isPro: false, reason: 'EXPIRED' };
      }
      return { isPro: true, reason: 'ACTIVE' };
    }

    if (status === 'TRIALING') {
      if (expiresAt && expiresAt < now) {
        return { isPro: false, reason: 'EXPIRED' };
      }
      return { isPro: true, reason: 'TRIALING' };
    }

    if (status === 'CANCELED') {
      if (expiresAt && expiresAt > now) {
        return { isPro: true, reason: 'CANCELED' };
      }
      return { isPro: false, reason: 'EXPIRED' };
    }

    return { isPro: false, reason: status };
  }
};
