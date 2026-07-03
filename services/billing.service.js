import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { EntitlementsService } from './entitlements.service.js';
import { BillingEventGateway } from './billing-event-gateway.js';

export async function createSubscription({ userId, planId, traceId }) {
  logger.info('billing.service.createSubscription', { traceId, userId, planId });
  if (!userId) throw new Error('userId is required');

  if (!supabaseAdmin) {
    return { id: `sub_mock_${Date.now()}`, status: 'active', planId, userId };
  }

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .insert({ user_id: userId, plan: planId || 'pro', status: 'active' })
    .select('*')
    .single();

  if (error && error.code !== '23505') throw error;
  return data || { status: 'active', user_id: userId };
}

export async function processPixExpirationWarnings({ traceId }) {
  logger.info('billing.service.processPixExpirationWarnings', { traceId });
  if (!supabaseAdmin) return;

  const now = new Date();

  try {
    const { data: pixSubs, error } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, status, current_period_end')
      .in('status', ['active', 'expired'])
      .or('billing_type.eq.pix,auto_renew.eq.false');

    if (error) {
      logger.error('billing.service.pix_warnings_fetch_failed', { traceId, error: error.message });
      return;
    }

    let warningCount = 0;

    for (const sub of pixSubs || []) {
      if (!sub.current_period_end || !sub.user_id) continue;
      const currentPeriodEnd = new Date(sub.current_period_end);
      const diffMs = currentPeriodEnd.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      let daysVal = null;
      let title = '';
      let body = '';

      if (sub.status === 'active') {
        if (diffDays > 6.0 && diffDays <= 7.0) {
          daysVal = '7';
          title = 'Sua assinatura Premium expira em 7 dias 📅';
          body = 'Evite a interrupção dos seus serviços renovando sua assinatura via PIX.';
        } else if (diffDays > 2.0 && diffDays <= 3.0) {
          daysVal = '3';
          title = 'Sua assinatura Premium expira em 3 dias ⏳';
          body = 'Faltam apenas 3 dias para sua assinatura expirar. Renove agora via PIX!';
        } else if (diffDays > 0.0 && diffDays <= 1.0) {
          daysVal = '1';
          title = 'Sua assinatura Premium expira amanhã ⚠️';
          body = 'Sua assinatura expira amanhã. Garanta seu acesso PRO realizando o pagamento.';
        }
      }

      // Dia do vencimento
      if (diffDays > -1.0 && diffDays <= 0.0) {
        daysVal = '0';
        title = 'Sua assinatura Premium vence hoje! ⏰';
        body = 'Sua assinatura expira hoje. Faça o pagamento via PIX para manter o acesso PRO.';
      }

      // 1 dia após vencimento
      if (sub.status === 'expired' && diffDays > -2.0 && diffDays <= -1.0) {
        daysVal = '-1';
        title = 'Sua assinatura Premium expirou 🚫';
        body = 'Sua assinatura expirou. Renove agora via PIX para reaver o acesso premium!';
      }

      if (daysVal !== null) {
        const idempotencyKey = `pix_exp_warn_${sub.user_id}_${daysVal}`;
        try {
          const { error: insertErr } = await supabaseAdmin.from('notification_queue').insert({
            user_id: sub.user_id,
            title,
            body,
            scheduled_for: new Date().toISOString(),
            entity_id: sub.user_id,
            entity_type: 'subscription',
            status: 'pending',
            idempotency_key: idempotencyKey
          });
          if (!insertErr) {
            warningCount++;
          } else if (insertErr.code !== '23505') {
            logger.warn('billing.service.pix_warning_insert_failed', { traceId, userId: sub.user_id, error: insertErr.message });
          }
        } catch (err) {
          logger.error('billing.service.pix_warning_exception', { traceId, userId: sub.user_id, error: err.message });
        }
      }
    }

    logger.info('billing.service.pix_warnings_processed', { traceId, warningCount });
  } catch (err) {
    logger.error('billing.service.pix_warnings_global_error', { traceId, error: err.message });
  }
}

export async function checkBillingExpirations({ traceId }) {
  logger.info('billing.service.checkBillingExpirations', { traceId });
  if (!supabaseAdmin) return { expiredCount: 0 };

  // Enviar lembretes automáticos para assinaturas PIX
  await processPixExpirationWarnings({ traceId });

  const now = new Date().toISOString();
  const { data: expired } = await supabaseAdmin
    .from('subscriptions')
    .select('id, user_id')
    .eq('status', 'active')
    .lt('current_period_end', now);

  if (!expired || expired.length === 0) return { expiredCount: 0 };

  // Emitir evento de expiração para cada assinatura expirada
  logger.info('billing.service.checkBillingExpirations.emittingEvents', { traceId, expiredCount: expired.length });
  for (const exp of expired) {
    if (exp.user_id) {
      await BillingEventGateway.emitEvent({
        type: 'subscription_expired',
        userId: exp.user_id,
        providerEventId: `evt_exp_${exp.user_id}_${new Date(now).getTime()}`,
        subscriptionId: exp.id,
        status: 'expired'
      });
    }
  }

  return { expiredCount: expired.length };
}
