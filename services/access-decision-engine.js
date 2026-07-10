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
import { isAdmin } from '../lib/auth/adminAuth.js';

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
      // 0. Auto-grant PRO access to Admin Master users
      try {
        const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authUser && isAdmin(authUser)) {
          return {
            plan: 'pro',
            status: 'active',
            canAccessPro: true,
            limits: {
              ai_requests: 100,
              tasks: 'unlimited'
            },
            reason: 'admin_automatic_access',
            subscriptionDetails: {
              plan: 'pro',
              status: 'active',
              current_period_start: null,
              current_period_end: null,
              price: 0,
              provider: 'admin'
            }
          };
        }
      } catch (e) {
        console.warn('[AccessDecisionEngine] Could not fetch user or check admin status:', e.message);
      }

      let canAccessPro = false;
      let plan = 'free';
      let status = 'free';
      let reason = 'no_active_subscription';

      // 1. Consulta estrita de direitos ativos em user_entitlements
      const { data: entitlement, error } = await supabaseAdmin
        .from('user_entitlements')
        .select('status, valid_until')
        .eq('user_id', userId)
        .eq('feature', 'pro_features')
        .eq('status', 'active')
        .gt('valid_until', nowIso)
        .maybeSingle();

      if (!error && entitlement) {
        canAccessPro = true;
        plan = 'premium';
        status = 'active';
        reason = 'subscription_active';
      } else {
        // Fallback resiliente: se a tabela user_entitlements não existir ou a consulta falhar,
        // verifica diretamente na tabela subscriptions.
        console.warn(`[AccessDecisionEngine] Entitlements não disponível. Usando fallback na tabela subscriptions para o usuário ${userId}`);
        const { data: activeSub, error: subErr } = await supabaseAdmin
          .from('subscriptions')
          .select('plan, status, current_period_end')
          .eq('user_id', userId)
          .eq('status', 'active')
          .eq('provider', 'asaas')
          .gt('current_period_end', nowIso)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!subErr && activeSub) {
          canAccessPro = true;
          plan = activeSub.plan || 'premium';
          status = 'active';
          reason = 'subscription_active_fallback';
        }
      }

      // Fetch latest subscription details for presentation in Settings / UI
      const { data: subData } = await supabaseAdmin
        .from('subscriptions')
        .select('plan, status, current_period_start, current_period_end, price, provider, created_at, auto_renew')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let subscriptionDetails = null;
      if (subData) {
        subscriptionDetails = {
          plan: subData.plan || 'pro',
          status: subData.status || 'free',
          current_period_start: subData.current_period_start || subData.created_at || null,
          current_period_end: subData.current_period_end || null,
          price: subData.price ? Number(subData.price) : 29.90,
          provider: subData.provider || 'asaas',
          auto_renew: subData.auto_renew ?? false
        };
      } else if (entitlement) {
        subscriptionDetails = {
          plan: 'pro',
          status: 'active',
          current_period_start: null,
          current_period_end: entitlement.valid_until || null,
          price: 29.90,
          provider: 'system',
          auto_renew: false
        };
      }

      return {
        plan,
        status,
        canAccessPro,
        limits: {
          ai_requests: canAccessPro ? 100 : 0,
          tasks: canAccessPro ? 'unlimited' : '30_days_limit'
        },
        reason,
        subscriptionDetails
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
