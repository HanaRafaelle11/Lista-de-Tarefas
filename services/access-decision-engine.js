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
  evaluateAccess(profile) {
    if (!profile) {
      return { isPro: false, reason: 'INVALID' };
    }

    const plano = (profile.plano || 'free').toLowerCase();
    const status = (profile.assinatura_status || 'free').toUpperCase();
    const expiresAt = profile.assinatura_expira_em ? new Date(profile.assinatura_expira_em) : null;
    const now = new Date();

    // Se o plano no banco de dados não for premium, o acesso Pro é negado
    if (plano !== 'premium') {
      return { isPro: false, reason: 'FREE' };
    }

    // Avaliar a máquina de estados unificada
    switch (status) {
      case 'ACTIVE':
        // Se houver uma data de expiração definida e ela estiver no passado, o acesso expirou
        if (expiresAt && expiresAt < now) {
          return { isPro: false, reason: 'EXPIRED' };
        }
        return { isPro: true, reason: 'ACTIVE' };

      case 'TRIALING':
        // Período de testes gratuito ou promocional
        if (expiresAt && expiresAt < now) {
          return { isPro: false, reason: 'EXPIRED' };
        }
        return { isPro: true, reason: 'TRIALING' };

      case 'CANCELED':
        // Grace Period (Período de carência): se a data de expiração estiver no futuro,
        // o usuário continua com acesso premium até o final do período pago.
        if (expiresAt && expiresAt > now) {
          return { isPro: true, reason: 'CANCELED' };
        }
        return { isPro: false, reason: 'EXPIRED' };

      case 'PAST_DUE':
        // Pagamento atrasado ou recusado: corta o acesso Pro imediatamente
        return { isPro: false, reason: 'PAST_DUE' };

      case 'EXPIRED':
        // Assinatura explicitamente vencida
        return { isPro: false, reason: 'EXPIRED' };

      case 'REACTIVATION_PENDING':
        // Em transição de retorno, aguardando confirmação do pagamento
        return { isPro: false, reason: 'REACTIVATION_PENDING' };

      default:
        // Caso ocorra qualquer inconsistência ou status desconhecido com plano premium
        return { isPro: false, reason: 'INVALID' };
    }
  }
};
