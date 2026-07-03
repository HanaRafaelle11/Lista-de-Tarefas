/**
 * Access Decision Engine (Fonte Absoluta de Verdade - SSOT)
 * 
 * Este serviço é a única autoridade final que decide se um usuário
 * tem acesso premium ativo baseando-se estritamente na tabela subscriptions.
 * 
 * TAREFA 1 & 6: Decisão crítica SEMPRE consulta o banco de dados direto (SSOT).
 * O cache local serve unicamente como telemetria secundária e nunca dita autorizações.
 */
import { supabaseAdmin } from '../lib/supabase.js';
import { EntitlementsService } from './entitlements.service.js';

const isProCache = new Map();

export const AccessDecisionEngine = {
  /**
   * Invalida qualquer resíduo de estado local (disparado ao processar webhooks).
   * @param {string} userId
   */
  invalidateCache(userId) {
    if (userId) {
      isProCache.delete(userId);
      console.log(`[AccessDecisionEngine Cache] Cache desativado/limpo para o usuário: ${userId}`);
    }
  },

  /**
   * Obtém a resolução detalhada e canônica de acesso do usuário.
   * Consulta direta e determinística na tabela de entitlements.
   * 
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getAccessResolution(userId) {
    if (!userId) {
      return {
        plan: 'free',
        status: 'free',
        canAccessPro: false,
        limits: {
          ai_requests: 0,
          tasks: 'limited'
        },
        reason: 'unauthenticated'
      };
    }

    const nowIso = new Date().toISOString();
    try {
      // 1. Consulta estrita de direitos ativos em user_entitlements
      const { data: entitlement, error } = await supabaseAdmin
        .from('user_entitlements')
        .select('status, valid_until')
        .eq('user_id', userId)
        .eq('feature', 'pro_features')
        .eq('status', 'active')
        .gt('valid_until', nowIso)
        .maybeSingle();

      if (error) {
        console.error(`[AccessDecisionEngine DB Error] Falha ao consultar entitlements para ${userId}:`, error.message);
        return {
          plan: 'free',
          status: 'free',
          canAccessPro: false,
          limits: { ai_requests: 0, tasks: 'limited' },
          reason: 'database_error'
        };
      }

      const canAccessPro = !!entitlement;
      
      return {
        plan: canAccessPro ? 'premium' : 'free',
        status: canAccessPro ? entitlement.status : 'free',
        canAccessPro,
        limits: {
          ai_requests: canAccessPro ? 100 : 0,
          tasks: canAccessPro ? 'unlimited' : '30_days_limit'
        },
        reason: canAccessPro ? 'subscription_active' : 'no_active_subscription'
      };
    } catch (err) {
      console.error(`[AccessDecisionEngine Exception] Erro ao obter access resolution para ${userId}:`, err.message);
      return {
        plan: 'free',
        status: 'free',
        canAccessPro: false,
        limits: { ai_requests: 0, tasks: 'limited' },
        reason: 'exception'
      };
    }
  },

  /**
   * Função Canônica Determinística de Validação de Acesso Pro em Escala.
   * 
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async isPro(userId) {
    const res = await this.getAccessResolution(userId);
    return res.canAccessPro;
  },

  /**
   * Avalia um objeto de assinatura para determinar o veredito determinístico.
   * @param {Object} subscription - Registro da tabela subscriptions
   */
  evaluateAccess(subscription) {
    if (!subscription) {
      return { isPro: false, reason: 'FREE' };
    }

    const status = (subscription.status || 'free').toLowerCase();
    const provider = (subscription.provider || 'asaas').toLowerCase();
    const expiresAt = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
    const now = new Date();

    if (provider !== 'asaas') {
      return { isPro: false, reason: 'ARCHIVED_PROVIDER' };
    }

    if (status === 'active') {
      if (expiresAt && expiresAt < now) {
        return { isPro: false, reason: 'EXPIRED' };
      }
      return { isPro: true, reason: 'ACTIVE' };
    }

    return { isPro: false, reason: status.toUpperCase() };
  }
};
