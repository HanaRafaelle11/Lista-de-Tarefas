/**
 * Access Decision Engine (Fonte Absoluta de Verdade - SSOT)
 * 
 * Este serviço é a única autoridade final que decide se um usuário
 * tem acesso premium ativo baseando-se estritamente na tabela subscriptions.
 */
import { supabaseAdmin } from '../lib/supabase.js';

const isProCache = new Map();
const CACHE_TTL_MS = 30000; // TTL curto de 30 segundos para máxima performance

export const AccessDecisionEngine = {
  /**
   * Invalida o cache de um usuário imediatamente (chamado no processamento de webhooks).
   * @param {string} userId
   */
  invalidateCache(userId) {
    if (userId) {
      isProCache.delete(userId);
      console.log(`[AccessDecisionEngine Cache] Cache de isPro invalidado para o usuário: ${userId}`);
    }
  },

  /**
   * Função Única e Canônica para verificar se um usuário é Pro com cache curto.
   * SSOT: status = 'active' AND provider = 'asaas' AND current_period_end > now()
   * 
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async isPro(userId) {
    if (!userId) return false;

    const nowMs = Date.now();
    const cached = isProCache.get(userId);
    if (cached && cached.expiresAt > nowMs) {
      return cached.isPro;
    }

    const nowIso = new Date().toISOString();
    try {
      const { data: activeSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('provider', 'asaas')
        .gt('current_period_end', nowIso)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const result = !!activeSub;
      isProCache.set(userId, { isPro: result, expiresAt: nowMs + CACHE_TTL_MS });
      return result;
    } catch (err) {
      console.error(`[AccessDecisionEngine] Erro ao consultar isPro para ${userId}:`, err.message);
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
