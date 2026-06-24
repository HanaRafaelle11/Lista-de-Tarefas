import { supabaseAdmin } from '../lib/supabase.js';
import { sendPushNotification } from './push-notification-service.js';
import { SubscriptionStateMachine } from './subscription-state-machine.js';
import { DistributedLock } from './distributed-lock.js';
import { BillingTracer, BillingLogger } from './billing-tracer.js';

async function insertEvent(userId, eventType, metadata = {}) {
  const event = {
    user_id: userId,
    event_type: eventType,
    metadata
  };
  console.log("[EVENT INSERT]", {
    file: "services/billing-engine.js",
    user_id: userId,
    auth_uid: null,
    payload: event
  });
  try {
    const { error } = await supabaseAdmin.from('events').insert([event]);
    if (error) console.error(error);
  } catch (err) {
    console.error(err);
  }
}

/**
 * Billing Engine (Core Logic - Production Hardened)
 * 
 * Camada centralizada única responsável por atualizar o Supabase,
 * gerenciar a máquina de estados de assinaturas e garantir persistência baseada em eventos.
 */
export const BillingEngine = {
  /**
   * Ativa o plano premium para o usuário (Upgrades).
   * Emite obrigatoriamente: user_upgraded.
   */
  async setUserPremium(userId, customerId, expiresAt, paymentId = null) {
    if (!userId) throw new Error('[BillingEngine.setUserPremium] userId é obrigatório');

    return await DistributedLock.withLock(`subscription:${userId}`, async () => {
      const now = new Date();
      const defaultExpiry = new Date();
      defaultExpiry.setDate(now.getDate() + 30);
      const expirationDate = expiresAt ? new Date(expiresAt) : defaultExpiry;

      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const currentStatus = currentSub?.status || null;
      const nextStatus = SubscriptionStateMachine.transition(currentStatus, 'active');

      BillingLogger.info('user_upgraded_attempt', paymentId, null, {
        userId,
        currentStatus,
        nextStatus,
        expiresAt: expirationDate.toISOString()
      });

      // 1. Atualizar profiles no Supabase (Fonte Única de Verdade)
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({
          plano: 'premium',
          assinatura_status: nextStatus,
          assinatura_inicio: now.toISOString(),
          assinatura_expira_em: expirationDate.toISOString(),
          mercadopago_customer_id: customerId || null,
          updated_at: now.toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        BillingLogger.error('profile_update_failed', paymentId, null, error, { userId });
        throw error;
      }

      // Update subscriptions table (Analytical Source of Truth)
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id: userId,
          status: nextStatus,
          plan: 'premium',
          price: 14.90,
          current_period_start: now.toISOString(),
          current_period_end: expirationDate.toISOString(),
          last_payment_id: paymentId || null,
          provider: 'mercado_pago',
          updated_at: now.toISOString()
        }, { onConflict: 'user_id' });

      if (subError) {
        BillingLogger.error('subscription_upsert_failed', paymentId, null, subError, { userId });
      }

      // 2. Garantir faturamento orientado a eventos: gerar entrada em billing_events se for atualização direta
      const syntheticId = `upg_${userId}_${Date.now()}`;
      const { error: billingEventError } = await supabaseAdmin
        .from('billing_events')
        .insert([{
          user_id: userId,
          type: 'payment_success',
          status: 'approved',
          amount: 14.90,
          currency: 'BRL',
          provider: 'system',
          metadata: {
            payment_id: syntheticId
          },
          created_at: now.toISOString()
        }]);
      
      if (billingEventError) {
        BillingLogger.warn('billing_event_insert_failed', paymentId, null, { message: billingEventError.message });
      }

      // 3. Gravar evento analítico obrigatório: user_upgraded
      const { error: eventError } = await supabaseAdmin
        .from('events')
        .insert([{
          user_id: userId,
          event_type: 'user_upgraded',
          metadata: {
            plano: 'premium',
            status: 'active',
            customer_id: customerId,
            expires_at: expirationDate.toISOString()
          }
        }]);

      if (eventError) {
        BillingLogger.warn('event_log_insert_failed', paymentId, null, { message: eventError.message });
      }

      // Trace record
      await BillingTracer.recordTrace({
        paymentId,
        userId,
        eventType: 'user_upgraded',
        stateBefore: currentStatus,
        stateAfter: nextStatus,
        source: 'billing_engine',
        metadata: { expiresAt: expirationDate.toISOString() }
      });

      return data;
    });
  },

  /**
   * Retorna o usuário para o plano gratuito (Free / Downgrades / Expired).
   * Emite obrigatoriamente: user_downgraded.
   */
  async setUserFree(userId, targetStatus = 'canceled') {
    if (!userId) throw new Error('[BillingEngine.setUserFree] userId é obrigatório');

    return await DistributedLock.withLock(`subscription:${userId}`, async () => {
      const normalizedTarget = targetStatus.toLowerCase();
      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const currentStatus = currentSub?.status || null;
      const nextStatus = SubscriptionStateMachine.transition(currentStatus, normalizedTarget);

      BillingLogger.info('user_downgraded_attempt', null, null, {
        userId,
        currentStatus,
        nextStatus
      });

      // 1. Atualizar profiles no Supabase
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({
          plano: 'free',
          assinatura_status: nextStatus,
          assinatura_inicio: null,
          assinatura_expira_em: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        BillingLogger.error('profile_downgrade_failed', null, null, error, { userId });
        throw error;
      }

      // Update subscriptions table (Analytical Source of Truth)
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id: userId,
          status: nextStatus,
          plan: 'premium',
          price: 14.90,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (subError) {
        BillingLogger.error('subscription_downgrade_upsert_failed', null, null, subError, { userId });
      }

      // 2. Garantir faturamento orientado a eventos: gerar entrada em billing_events
      const syntheticId = `down_${userId}_${Date.now()}`;
      const { error: billingEventError } = await supabaseAdmin
        .from('billing_events')
        .insert([{
          user_id: userId,
          type: 'subscription_cancelled',
          status: 'refunded',
          amount: 14.90,
          currency: 'BRL',
          provider: 'system',
          metadata: {
            payment_id: syntheticId
          },
          created_at: new Date().toISOString()
        }]);

      if (billingEventError) {
        BillingLogger.warn('billing_event_downgrade_insert_failed', null, null, { message: billingEventError.message });
      }

      // 3. Gravar evento analítico de cancelamento/expiração: user_downgraded
      const { error: eventError } = await supabaseAdmin
        .from('events')
        .insert([{
          user_id: userId,
          event_type: 'user_downgraded',
          metadata: {
            plano: 'free',
            status: nextStatus
          }
        }]);

      if (eventError) {
        BillingLogger.warn('event_log_downgrade_insert_failed', null, null, { message: eventError.message });
      }

      // Trace record
      await BillingTracer.recordTrace({
        paymentId: null,
        userId,
        eventType: 'user_downgraded',
        stateBefore: currentStatus,
        stateAfter: nextStatus,
        source: 'billing_engine',
        metadata: { targetStatus: nextStatus }
      });

      return data;
    });
  },

  /**
   * Processa pagamento aprovado e valida idempotência contra a tabela billing_events.
   */
  async handlePaymentApproved(userId, customerId, paymentId, paymentData = {}) {
    if (!userId) throw new Error('[BillingEngine.handlePaymentApproved] userId é obrigatório');
    if (!paymentId) throw new Error('[BillingEngine.handlePaymentApproved] paymentId é obrigatório');

    return await DistributedLock.withLock(`subscription:${userId}`, async () => {
      const { data: currentProfile } = await supabaseAdmin
        .from('profiles')
        .select('plano, assinatura_status')
        .eq('id', userId)
        .maybeSingle();

      if (currentProfile?.plano === 'premium' && currentProfile?.assinatura_status === 'active') {
        BillingLogger.info('payment_approved_already_premium', paymentId, null, { userId });
        return { success: true, duplicated: false, alreadyPremium: true };
      }

      const paymentStr = String(paymentId);
      BillingLogger.info('payment_approved_processing', paymentStr, null, { userId });

      // Emite obrigatoriamente: payment_received
      await insertEvent(userId, 'payment_received', { payment_id: paymentStr, status: 'approved' });

      try {
        // 1. Verificação de Idempotência: Checar se o pagamento já existe na tabela billing_events
        const { data: existingEvent, error: searchError } = await supabaseAdmin
          .from('billing_events')
          .select('id, status')
          .eq('metadata->>payment_id', paymentStr)
          .maybeSingle();

        if (searchError) {
          BillingLogger.error('idempotency_check_failed', paymentStr, null, searchError, { userId });
          throw searchError;
        }

        if (existingEvent) {
          BillingLogger.info('payment_ignored_duplicate', paymentStr, null, { userId });
          await insertEvent(userId, 'payment_ignored_duplicate', { payment_id: paymentStr });
          return { success: true, duplicated: true };
        }

        // 2. Registrar o pagamento aprovado na tabela billing_events
        const { error: insertEventError } = await supabaseAdmin
          .from('billing_events')
          .insert([{
            user_id: userId,
            type: 'payment_success',
            status: 'approved',
            amount: paymentData.transaction_amount || 14.90,
            currency: 'BRL',
            provider: 'mercadopago',
            metadata: {
              payment_id: paymentStr,
              date_approved: paymentData.date_approved || new Date().toISOString()
            },
            created_at: new Date().toISOString()
          }]);

        if (insertEventError) {
          if (insertEventError.code === '23505') {
            BillingLogger.info('payment_ignored_duplicate_race', paymentStr, null, { userId });
            await insertEvent(userId, 'payment_ignored_duplicate', { payment_id: paymentStr });
            return { success: true, duplicated: true };
          }
          throw insertEventError;
        }

        // Emite obrigatoriamente: payment_approved
        await insertEvent(userId, 'payment_approved', {
          payment_id: paymentStr,
          amount: paymentData.transaction_amount || 14.90,
          date_approved: paymentData.date_approved || new Date().toISOString()
        });

        // 3. Checar se o usuário estava anteriormente CANCELED/EXPIRED para aplicar reativação
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('assinatura_status')
          .eq('id', userId)
          .maybeSingle();

        const wasCanceled = profile?.assinatura_status === 'canceled';

        // 4. Calcular data de expiração
        let expiresAt = null;
        if (paymentData.date_of_expiration) {
          expiresAt = paymentData.date_of_expiration;
        } else {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          expiresAt = d.toISOString();
        }

        // 5. Executar ativação do Premium
        const updatedProfile = await this.setUserPremium(userId, customerId, expiresAt, paymentStr);

        // 6. Loop de reativação (Recovery & Reactivation Loop)
        if (wasCanceled) {
          await this.handleUserReactivated(userId, paymentStr);
        } else {
          await sendPushNotification(userId, "Pagamento confirmado", "Sua assinatura MyFlowDay Premium foi confirmada com sucesso! ⚡");
        }

        // Trace Record
        await BillingTracer.recordTrace({
          paymentId: paymentStr,
          userId,
          eventType: 'payment_approved',
          stateBefore: profile?.assinatura_status || 'free',
          stateAfter: 'active',
          source: 'billing_engine',
          metadata: { amount: paymentData.transaction_amount || 14.90 }
        });

        return { success: true, duplicated: false, profile: updatedProfile };
      } catch (err) {
        BillingLogger.error('payment_approved_processing_failed', paymentStr, null, err, { userId });
        throw err;
      }
    });
  },

  /**
   * Processa pagamento cancelado.
   * Emite obrigatoriamente: payment_failed.
   */
  async handlePaymentCanceled(userId) {
    if (!userId) throw new Error('[BillingEngine.handlePaymentCanceled] userId é obrigatório');

    return await DistributedLock.withLock(`subscription:${userId}`, async () => {
      BillingLogger.info('payment_canceled_processing', null, null, { userId });
      
      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      // Emite obrigatoriamente: payment_failed
      await insertEvent(userId, 'payment_failed', { reason: 'payment_canceled' });

      const updatedProfile = await this.setUserFree(userId, 'canceled');
      await sendPushNotification(userId, "Assinatura cancelada", "Sua assinatura foi cancelada. Seu plano premium foi encerrado.");

      // Trace Record
      await BillingTracer.recordTrace({
        paymentId: null,
        userId,
        eventType: 'payment_canceled',
        stateBefore: currentSub?.status || 'free',
        stateAfter: 'canceled',
        source: 'billing_engine'
      });

      return { success: true, profile: updatedProfile };
    });
  },

  /**
   * Processa assinatura com pagamento pendente/atrasado (Invalida premium).
   * Emite obrigatoriamente: payment_failed e past_due.
   */
  async handlePaymentPastDue(userId) {
    if (!userId) throw new Error('[BillingEngine.handlePaymentPastDue] userId é obrigatório');

    return await DistributedLock.withLock(`subscription:${userId}`, async () => {
      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const currentStatus = currentSub?.status || null;
      const nextStatus = SubscriptionStateMachine.transition(currentStatus, 'past_due');

      BillingLogger.info('payment_past_due_processing', null, null, { userId, currentStatus, nextStatus });

      // Emite obrigatoriamente: payment_failed
      await insertEvent(userId, 'payment_failed', { reason: 'past_due' });

      // 1. Atualizar profiles no Supabase (status PAST_DUE, plano free)
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({
          plano: 'free',
          assinatura_status: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        BillingLogger.error('profile_past_due_update_failed', null, null, error, { userId });
        throw error;
      }

      // Update subscriptions table (Analytical Source of Truth)
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id: userId,
          status: nextStatus,
          plan: 'premium',
          price: 14.90,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (subError) {
        BillingLogger.error('subscription_past_due_upsert_failed', null, null, subError, { userId });
      }

      // 2. Garantir faturamento orientado a eventos: gerar entrada em billing_events
      const syntheticId = `pastdue_${userId}_${Date.now()}`;
      await supabaseAdmin
        .from('billing_events')
        .insert([{
          user_id: userId,
          type: 'payment_failed',
          status: 'past_due',
          amount: 14.90,
          currency: 'BRL',
          provider: 'system',
          metadata: {
            payment_id: syntheticId,
            reason: 'past_due'
          },
          created_at: new Date().toISOString()
        }]);

      // 3. Gravar evento analítico de downgrade: user_downgraded
      await supabaseAdmin
        .from('events')
        .insert([{
          user_id: userId,
          event_type: 'user_downgraded',
          metadata: {
            plano: 'free',
            status: 'past_due'
          }
        }]);

      // Trace Record
      await BillingTracer.recordTrace({
        paymentId: null,
        userId,
        eventType: 'payment_past_due',
        stateBefore: currentStatus,
        stateAfter: nextStatus,
        source: 'billing_engine'
      });

      return { success: true, profile: data };
    });
  },

  /**
   * Corrige inconsistências identificadas pelo Job de Reconciliação (Anti-drift System).
   * Emite obrigatoriamente: reconciliation_fix_applied.
   */
  async handleReconciliationFix(userId, targetPlan, targetStatus, customerId, expiresAt, reason) {
    if (!userId) throw new Error('[BillingEngine.handleReconciliationFix] userId é obrigatório');

    return await DistributedLock.withLock(`subscription:${userId}`, async () => {
      const normalizedStatus = targetStatus.toLowerCase();
      BillingLogger.info('reconciliation_fix_attempt', null, null, { userId, targetPlan, targetStatus, reason });

      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      const currentStatus = currentSub?.status || null;

      // 1. Garantir faturamento orientado a eventos: gerar entrada em billing_events
      const syntheticId = `rec_${userId}_${Date.now()}`;
      await supabaseAdmin
        .from('billing_events')
        .insert([{
          user_id: userId,
          type: normalizedStatus === 'active' ? 'payment_success' : 'subscription_canceled',
          status: normalizedStatus === 'active' ? 'approved' : 'reconciled_downgrade',
          amount: 14.90,
          currency: 'BRL',
          provider: 'system',
          metadata: {
            payment_id: syntheticId,
            reason
          },
          created_at: new Date().toISOString()
        }]);

      let data;
      if (targetPlan === 'premium' && normalizedStatus === 'active') {
        data = await this.setUserPremium(userId, customerId, expiresAt);
      } else {
        // Correção para free/cancelado
        const { data: updated, error } = await supabaseAdmin
          .from('profiles')
          .update({
            plano: targetPlan,
            assinatura_status: normalizedStatus,
            assinatura_expira_em: expiresAt ? new Date(expiresAt).toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) {
          BillingLogger.error('reconciliation_profile_update_failed', null, null, error, { userId });
          throw error;
        }
        data = updated;

        const nextStatus = SubscriptionStateMachine.transition(currentStatus, normalizedStatus);

        // Update subscriptions table (Analytical Source of Truth)
        const { error: subError } = await supabaseAdmin
          .from('subscriptions')
          .upsert({
            user_id: userId,
            status: nextStatus,
            plan: 'premium',
            price: 14.90,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (subError) {
          BillingLogger.error('reconciliation_sub_upsert_failed', null, null, subError, { userId });
        }

        // Gravar evento de downgrade por reconciliação: user_downgraded
        await insertEvent(userId, 'user_downgraded', { plano: targetPlan, status: normalizedStatus, reason });
      }

      // 2. Gravar o log obrigatório de correção de faturamento: reconciliation_fix_applied (drift_resolved)
      await insertEvent(userId, 'reconciliation_fix_applied', {
        target_plan: targetPlan,
        target_status: normalizedStatus,
        reason
      });

      // Trace Record
      await BillingTracer.recordTrace({
        paymentId: null,
        userId,
        eventType: 'reconciliation_fix',
        stateBefore: currentStatus,
        stateAfter: targetStatus,
        source: 'reconciliation',
        metadata: { reason }
      });

      return data;
    });
  },

  /**
   * Integração Churn Engine: Trata a detecção de risco de churn no usuário.
   */
  async handleChurnRiskDetected(userId, riskLevel, churnScore) {
    if (!userId) throw new Error('[BillingEngine.handleChurnRiskDetected] userId é obrigatório');

    BillingLogger.info('churn_risk_detected', null, null, { userId, riskLevel, churnScore });

    let retentionAction = 'none';
    if (riskLevel === 'high') {
      retentionAction = 'paywall_retention_discount';
    } else if (riskLevel === 'medium') {
      retentionAction = 'retention_push_notification';
    }

    await insertEvent(userId, 'retention_action_triggered', {
      risk_level: riskLevel,
      churn_score: churnScore,
      action: retentionAction,
      timestamp: new Date().toISOString()
    });

    return { riskLevel, churnScore, retentionAction };
  },

  /**
   * Recuperação de Usuário Cancelado (Reactivation Loop).
   * Emite obrigatoriamente: user_reactivated e subscription_recovered.
   */
  async handleUserReactivated(userId, paymentId) {
    if (!userId) throw new Error('[BillingEngine.handleUserReactivated] userId é obrigatório');

    BillingLogger.info('user_reactivation_loop', paymentId, null, { userId });

    // Gravar logs analíticos de reativação e recuperação
    await insertEvent(userId, 'user_reactivated', { payment_id: paymentId, recovered_at: new Date().toISOString() });
    await insertEvent(userId, 'subscription_recovered', { payment_id: paymentId, recovered_at: new Date().toISOString() });

    await sendPushNotification(userId, "Assinatura reativada", "Sua assinatura foi reativada com sucesso! Bem-vindo de volta! ⚡");
  }
};
