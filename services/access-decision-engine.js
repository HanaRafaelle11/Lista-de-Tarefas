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
   * Função Canônica Determinística de Validação de Acesso Pro em Escala.
   * SSOT Direta no Banco de Dados: status = 'active' AND provider = 'asaas' AND current_period_end > now()
   * 
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async isPro(userId) {
    if (!userId) return false;

    const nowIso = new Date().toISOString();
    try {
      // TAREFA 1 & 6: Consulta direta e determinística ao banco primário (SSOT em Escala Horizontal)
      const { data: activeSub, error } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('provider', 'asaas')
        .gt('current_period_end', nowIso)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(`[AccessDecisionEngine DB Error] Falha ao consultar isPro para ${userId}:`, error.message);
        return false;
      }

      const result = !!activeSub;
      return result;
    } catch (err) {
      console.error(`[AccessDecisionEngine Exception] Erro ao consultar isPro para ${userId}:`, err.message);
      return false;
    }
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
