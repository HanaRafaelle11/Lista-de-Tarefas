import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { EntitlementsService } from '../services/entitlements.service.js';
import {
  PLAN_PREMIUM_MONTHLY_PRICE,
  PLAN_FREE_PRICE,
  PLAN_PREMIUM_NAME,
  PLAN_FREE_NAME,
  PROVIDER_ASAAS
} from '../lib/billing/config.js';
import { AccessDecisionEngine } from '../services/access-decision-engine.js';
import { OpsMetrics } from '../services/ops-metrics.js';

/**
 * Billing Event Projector (Ouvinte/Projetor Reativo de Estado)
 * 
 * Fonte absoluta e exclusiva que altera as tabelas derivadas (projeções)
 * (subscriptions, profiles, user_entitlements) reagindo aos eventos lidos do ledger.
 */
export const BillingEventProjector = {
  /**
   * Projeta um evento do ledger de faturamento nas tabelas derivadas.
   * 
   * @param {Object} event - Evento persistido da tabela billing_events
   */
  async project(event) {
    if (!event || !event.event_type || !event.user_id) {
      throw new Error('[BillingEventProjector] Evento malformado.');
    }

    const { event_type: type, user_id: userId, payment_id: paymentId, subscription_id: subscriptionId, value, metadata } = event;
    const nowIso = new Date().toISOString();
    const meta = metadata || {};

    if (event.created_at) {
      const delayMs = Date.now() - new Date(event.created_at).getTime();
      OpsMetrics.recordProjectionDelay(delayMs);
    }

    logger.info('billing.event.projector.projecting', { type, userId, eventId: event.id });

    try {
      if (!supabaseAdmin) return;

      switch (type) {
        case 'subscription_activated': {
          const resolvedPlan = meta.plan || PLAN_PREMIUM_NAME;
          const nextStatus = 'active';
          const expiryDate = meta.current_period_end;
          const autoRenew = meta.auto_renew !== false;
          
          const subPayload = {
            user_id: userId,
            status: nextStatus,
            plan: resolvedPlan,
            price: Number(value) || PLAN_PREMIUM_MONTHLY_PRICE,
            amount: Number(value) || PLAN_PREMIUM_MONTHLY_PRICE,
            provider: PROVIDER_ASAAS,
            gateway: PROVIDER_ASAAS,
            billing_type: meta.billing_type || 'pix',
            auto_renew: autoRenew,
            current_period_end: expiryDate,
            updated_at: nowIso
          };
          if (paymentId) subPayload.last_payment_id = paymentId;
          if (meta.asaas_customer_id) subPayload.asaas_customer_id = meta.asaas_customer_id;
          if (subscriptionId) subPayload.asaas_subscription_id = subscriptionId;

          // 1. Atualizar Assinatura
          const { data: updateData, error: updateErr } = await supabaseAdmin
            .from('subscriptions')
            .update(subPayload)
            .eq('user_id', userId)
            .select();

          if (updateErr || !updateData || updateData.length === 0) {
            await supabaseAdmin.from('subscriptions').upsert(subPayload, { onConflict: 'user_id' });
          }

          // 2. Atualizar Perfil
          const profileUpdate = {
            plano: resolvedPlan,
            assinatura_status: nextStatus,
            assinatura_inicio: nowIso,
            assinatura_expira_em: expiryDate,
            updated_at: nowIso
          };
          if (meta.asaas_customer_id) {
            profileUpdate.asaas_customer_id = meta.asaas_customer_id;
          }
          await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', userId);

          // 3. Atualizar Entitlements (Direitos)
          await EntitlementsService.grantEntitlement(userId, 'pro_features', expiryDate);

          // 4. Inserir no ledger de balanço (billing_ledger)
          try {
            await supabaseAdmin.from('billing_ledger').insert([{
              user_id: userId,
              balance_change: Number(value) || PLAN_PREMIUM_MONTHLY_PRICE,
              reason: 'subscription_activated',
              reference_id: paymentId || `pay_${userId}_${nowIso}`,
              created_at: nowIso
            }]);
          } catch (ledgerErr) {
            logger.warn('billing.event.projector.ledger_failed', { userId, error: ledgerErr.message });
          }
          break;
        }

        case 'payment_overdue': {
          const nextStatus = 'past_due';

          // 1. Reverter perfil
          await supabaseAdmin.from('profiles').update({
            plano: PLAN_FREE_NAME,
            assinatura_status: nextStatus,
            assinatura_inicio: null,
            assinatura_expira_em: null,
            updated_at: nowIso
          }).eq('id', userId);

          // 2. Atualizar assinatura para past_due com valor zero
          const subUpdate = {
            user_id: userId,
            status: nextStatus,
            plan: PLAN_FREE_NAME,
            price: PLAN_FREE_PRICE,
            amount: PLAN_FREE_PRICE,
            updated_at: nowIso
          };
          if (paymentId) subUpdate.last_payment_id = paymentId;
          await supabaseAdmin.from('subscriptions').upsert(subUpdate, { onConflict: 'user_id' });

          // 3. Revogar direitos
          await EntitlementsService.revokeEntitlement(userId, 'pro_features', 'past_due');
          break;
        }

        case 'subscription_canceled': {
          const nextStatus = meta.target_status || 'canceled';
          const stillHasPaidTime = meta.still_has_paid_time === true;
          const periodEnd = meta.current_period_end;

          if (stillHasPaidTime) {
            // Mantém acesso até expirar, desativando auto_renew
            await supabaseAdmin.from('profiles').update({
              assinatura_status: nextStatus,
              updated_at: nowIso
            }).eq('id', userId);

            await supabaseAdmin.from('subscriptions').upsert({
              user_id: userId,
              status: nextStatus,
              auto_renew: false,
              updated_at: nowIso
            }, { onConflict: 'user_id' });
          } else {
            // Reverte imediatamente para free
            await supabaseAdmin.from('profiles').update({
              plano: PLAN_FREE_NAME,
              assinatura_status: nextStatus,
              assinatura_inicio: null,
              assinatura_expira_em: null,
              updated_at: nowIso
            }).eq('id', userId);

            await supabaseAdmin.from('subscriptions').upsert({
              user_id: userId,
              status: nextStatus,
              plan: PLAN_FREE_NAME,
              price: PLAN_FREE_PRICE,
              amount: PLAN_FREE_PRICE,
              auto_renew: false,
              updated_at: nowIso
            }, { onConflict: 'user_id' });

            // Revogar direitos
            await EntitlementsService.revokeEntitlement(userId, 'pro_features', 'canceled');
          }
          break;
        }

        case 'subscription_refunded': {
          const nextStatus = 'refunded';

          // 1. Reverter perfil
          await supabaseAdmin.from('profiles').update({
            plano: PLAN_FREE_NAME,
            assinatura_status: nextStatus,
            assinatura_inicio: null,
            assinatura_expira_em: null,
            updated_at: nowIso
          }).eq('id', userId);

          // 2. Reverter assinatura
          await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            status: nextStatus,
            plan: PLAN_FREE_NAME,
            price: PLAN_FREE_PRICE,
            amount: PLAN_FREE_PRICE,
            auto_renew: false,
            updated_at: nowIso
          }, { onConflict: 'user_id' });

          // 3. Revogar direitos
          await EntitlementsService.revokeEntitlement(userId, 'pro_features', 'refunded');
          break;
        }

        case 'subscription_expired': {
          const nextStatus = 'expired';

          // 1. Reverter perfil
          await supabaseAdmin.from('profiles').update({
            plano: PLAN_FREE_NAME,
            assinatura_status: nextStatus,
            assinatura_inicio: null,
            assinatura_expira_em: null,
            updated_at: nowIso
          }).eq('id', userId);

          // 2. Reverter assinatura
          await supabaseAdmin.from('subscriptions').upsert({
            user_id: userId,
            status: nextStatus,
            plan: PLAN_FREE_NAME,
            price: PLAN_FREE_PRICE,
            amount: PLAN_FREE_PRICE,
            auto_renew: false,
            updated_at: nowIso
          }, { onConflict: 'user_id' });

          // 3. Revogar direitos
          await EntitlementsService.revokeEntitlement(userId, 'pro_features', 'expired');
          break;
        }

        default: {
          logger.warn('billing.event.projector.unsupported_type', { type });
          break;
        }
      }

      // Invalida cache local
      AccessDecisionEngine.invalidateCache(userId);
      logger.info('billing.event.projector.projected_success', { type, userId });
    } catch (err) {
      logger.error('billing.event.projector.failed', { type, userId, error: err.message });
      throw err;
    }
  },

  /**
   * Executa a reconstrução total determinística do estado lendo e reprocessando
   * cronologicamente todo o ledger de eventos billing_events.
   * 
   * @param {Object} [options={}] - Opções de execução
   * @param {boolean} [options.force=false] - Forçar a execução se passar do limite seguro
   */
  async replayAllEvents(options = {}) {
    logger.info('billing.event.projector.replayAllEvents.start');
    try {
      if (!supabaseAdmin) {
        logger.error('billing.event.projector.replayAllEvents.no_supabaseAdmin');
        return false;
      }

      // 1. O rebuild reconstrói as projeções em formato de Upsert/Update de estado em tempo real
      logger.info('billing.event.projector.replayAllEvents.preparing_in_place_projection');

      // 1.5 Safety Guard: Verificar volume de eventos
      const { count: eventsCount, error: countErr } = await supabaseAdmin
        .from('billing_events')
        .select('*', { count: 'exact', head: true });

      const threshold = 100000;
      if (!countErr && eventsCount > threshold && !options.force) {
        logger.warn('billing.event.projector.replayAllEvents.safety_guard_triggered', { count: eventsCount });
        return {
          warning: true,
          count: eventsCount,
          message: `Volume de eventos (${eventsCount}) excede o limite seguro de ${threshold}. Defina force=true para prosseguir.`
        };
      }

      const startTime = Date.now();
      logger.info('replay started', { timestamp: new Date().toISOString() });
      OpsMetrics.replayStarted();

      // 2. Recuperar todos os eventos do Ledger ordenados por data
      const { data: events, error } = await supabaseAdmin
        .from('billing_events')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('billing.event.projector.replayAllEvents.fetch_failed', { error: error.message });
        OpsMetrics.replayCompleted(0, false);
        return false;
      }

      logger.info('billing.event.projector.replayAllEvents.processing', { count: events.length });

      // 3. Re-projetar eventos em ordem cronológica estrita
      for (const event of events) {
        await this.project(event);
      }

      const duration = Date.now() - startTime;
      logger.info('replay completed', {
        durationMs: duration,
        projectionsCount: events.length,
        timestamp: new Date().toISOString()
      });
      OpsMetrics.replayCompleted(events.length, true);

      logger.info('billing.event.projector.replayAllEvents.success');
      return true;
    } catch (err) {
      logger.error('billing.event.projector.replayAllEvents.exception', { error: err.message });
      OpsMetrics.replayCompleted(0, false);
      return false;
    }
  }
};


