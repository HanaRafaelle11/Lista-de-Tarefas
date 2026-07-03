import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

/**
 * Entitlements Service (Gestão de Direitos e Acesso)
 * 
 * Fonte absoluta de gravação de direitos Pro no sistema.
 * Segue o modelo Stripe-like: faturamento (subscriptions) gera eventos
 * que concedem direitos (entitlements). O acesso do usuário consulta estes direitos.
 */
export const EntitlementsService = {
  /**
   * Concede ou estende um direito de acesso (entitlement) para o usuário.
   * 
   * @param {string} userId - UUID do usuário
   * @param {string} feature - Nome do recurso (ex: 'pro_features')
   * @param {Date|string} validUntil - Data limite de validade do direito
   */
  async grantEntitlement(userId, feature, validUntil) {
    if (!userId || !feature || !validUntil) return false;
    
    const validUntilIso = new Date(validUntil).toISOString();
    const nowIso = new Date().toISOString();
    
    logger.info('entitlements.service.grantEntitlement', { userId, feature, validUntil: validUntilIso });

    try {
      if (!supabaseAdmin) {
        logger.warn('entitlements.service.grantEntitlement.noSupabaseAdmin');
        return false;
      }

      const { error } = await supabaseAdmin
        .from('user_entitlements')
        .upsert({
          user_id: userId,
          feature,
          status: 'active',
          valid_until: validUntilIso,
          updated_at: nowIso
        }, { onConflict: 'user_id,feature' });

      if (error) {
        logger.error('entitlements.service.grantEntitlement.db_error', { userId, error: error.message });
        return false;
      }

      return true;
    } catch (err) {
      logger.error('entitlements.service.grantEntitlement.exception', { userId, error: err.message });
      return false;
    }
  },

  /**
   * Revoga ou expira um direito de acesso (entitlement) do usuário.
   * 
   * @param {string} userId - UUID do usuário
   * @param {string} feature - Nome do recurso (ex: 'pro_features')
   * @param {string} reasonStatus - Status final ('expired' ou 'canceled')
   */
  async revokeEntitlement(userId, feature, reasonStatus = 'expired') {
    if (!userId || !feature) return false;
    
    const nowIso = new Date().toISOString();
    logger.info('entitlements.service.revokeEntitlement', { userId, feature, status: reasonStatus });

    try {
      if (!supabaseAdmin) return false;

      const { error } = await supabaseAdmin
        .from('user_entitlements')
        .update({
          status: reasonStatus,
          updated_at: nowIso
        })
        .eq('user_id', userId)
        .eq('feature', feature);

      if (error) {
        logger.error('entitlements.service.revokeEntitlement.db_error', { userId, error: error.message });
        return false;
      }

      return true;
    } catch (err) {
      logger.error('entitlements.service.revokeEntitlement.exception', { userId, error: err.message });
      return false;
    }
  },

  /**
   * Reconcilia e corrige os direitos de acesso de um usuário baseado em sua assinatura ativa.
   * Funciona como lazy-migration/reconciliador resiliente de inconsistências.
   * 
   * @param {string} userId - UUID do usuário
   */
  async reconcileUserEntitlement(userId) {
    if (!userId) return false;

    logger.info('entitlements.service.reconcileUserEntitlement', { userId });
    try {
      if (!supabaseAdmin) return false;

      const nowIso = new Date().toISOString();
      // 1. Busca assinatura ativa no faturamento
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

      if (subErr) {
        logger.error('entitlements.service.reconcile.sub_error', { userId, error: subErr.message });
        return false;
      }

      if (activeSub) {
        // Estende ou cria o entitlement
        return await this.grantEntitlement(userId, 'pro_features', activeSub.current_period_end);
      } else {
        // Se não possui assinatura ativa, garante que o entitlement correspondente está inativo
        const { data: existingEnt } = await supabaseAdmin
          .from('user_entitlements')
          .select('status')
          .eq('user_id', userId)
          .eq('feature', 'pro_features')
          .maybeSingle();

        if (existingEnt && existingEnt.status === 'active') {
          return await this.revokeEntitlement(userId, 'pro_features', 'expired');
        }
      }

      return true;
    } catch (err) {
      logger.error('entitlements.service.reconcile.exception', { userId, error: err.message });
      return false;
    }
  }
};
