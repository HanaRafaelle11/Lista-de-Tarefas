import { supabaseAdmin } from '../lib/supabase.js';
import { sendPushNotification } from './push-notification-service.js';

/**
 * Billing Engine (Core Logic - Production Consistent)
 * 
 * Camada centralizada única responsável por atualizar o Supabase,
 * gerenciar a máquina de estados de assinaturas e garantir persistência baseada em eventos.
 */

export const BillingEngine = {
  /**
   * Ativa o plano premium para o usuário (Upgrades).
   * Emite obrigatoriamente: user_upgraded.
   */
  async setUserPremium(userId, customerId, expiresAt) {
    if (!userId) throw new Error('[BillingEngine.setUserPremium] userId é obrigatório');

    const now = new Date();
    const defaultExpiry = new Date();
    defaultExpiry.setDate(now.getDate() + 30);

    const expirationDate = expiresAt ? new Date(expiresAt) : defaultExpiry;

    console.log(`[BillingEngine] [user_upgraded] Ativando Premium (ACTIVE) para o usuário ${userId}. Expira em: ${expirationDate.toISOString()}`);

    // 1. Atualizar profiles no Supabase (Fonte Única de Verdade)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        plano: 'premium',
        assinatura_status: 'active',
        assinatura_inicio: now.toISOString(),
        assinatura_expira_em: expirationDate.toISOString(),
        mercadopago_customer_id: customerId || null,
        updated_at: now.toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[BillingEngine.setUserPremium] Erro ao atualizar perfil:', error);
      throw error;
    }

    // Update subscriptions table (Analytical Source of Truth)
    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        status: 'active',
        plan: 'premium',
        price: 14.90,
        updated_at: now.toISOString(),
        created_at: now.toISOString()
      }, { onConflict: 'user_id' });

    if (subError) {
      console.error('[BillingEngine.setUserPremium] Erro ao atualizar subscriptions:', subError);
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
      console.warn('[BillingEngine.setUserPremium] Erro não-bloqueante ao registrar billing_events sintético:', billingEventError.message);
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
      console.warn('[BillingEngine.setUserPremium] Erro ao gravar evento analítico:', eventError.message);
    }

    return data;
  },

  /**
   * Retorna o usuário para o plano gratuito (Free / Downgrades / Expired).
   * Emite obrigatoriamente: user_downgraded.
   */
  async setUserFree(userId) {
    if (!userId) throw new Error('[BillingEngine.setUserFree] userId é obrigatório');

    console.log(`[BillingEngine] [user_downgraded] Removendo Premium do usuário ${userId} (Status: EXPIRED)`);

    // 1. Atualizar profiles no Supabase (status unificado EXPIRED e plano free)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        plano: 'free',
        assinatura_status: 'canceled',
        assinatura_inicio: null,
        assinatura_expira_em: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[BillingEngine.setUserFree] Erro ao atualizar perfil para free:', error);
      throw error;
    }

    // Update subscriptions table (Analytical Source of Truth)
    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        status: 'canceled',
        plan: 'premium',
        price: 14.90,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (subError) {
      console.error('[BillingEngine.setUserFree] Erro ao atualizar subscriptions:', subError);
    }

    // 2. Garantir faturamento orientado a eventos: gerar entrada em billing_events
    const syntheticId = `down_${userId}_${Date.now()}`;
    const { error: billingEventError } = await supabaseAdmin
      .from('billing_events')
      .insert([{
        user_id: userId,
        type: 'subscription_canceled',
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
      console.warn('[BillingEngine.setUserFree] Erro ao gravar billing_events sintético:', billingEventError.message);
    }

    // 3. Gravar evento analítico de cancelamento/expiração: user_downgraded
    const { error: eventError } = await supabaseAdmin
      .from('events')
      .insert([{
        user_id: userId,
        event_type: 'user_downgraded',
        metadata: {
          plano: 'free',
          status: 'canceled'
        }
      }]);

    if (eventError) {
      console.warn('[BillingEngine.setUserFree] Erro ao gravar evento analítico:', eventError.message);
    }

    return data;
  },

  /**
   * Processa pagamento aprovado e valida idempotência contra a tabela billing_events.
   */
  async handlePaymentApproved(userId, customerId, paymentId, paymentData = {}) {
    if (!userId) throw new Error('[BillingEngine.handlePaymentApproved] userId é obrigatório');
    if (!paymentId) throw new Error('[BillingEngine.handlePaymentApproved] paymentId é obrigatório');

    const paymentStr = String(paymentId);
    console.log(`[BillingEngine] Recebido processamento de pagamento aprovado. ID: ${paymentStr}, Usuário: ${userId}`);

    // Emite obrigatoriamente: payment_received
    await supabaseAdmin.from('events').insert([{
      user_id: userId,
      event_type: 'payment_received',
      metadata: { payment_id: paymentStr, status: 'approved' }
    }]);

    try {
      // 1. Verificação de Idempotência: Checar se o pagamento já existe na tabela billing_events
      const { data: existingEvent, error: searchError } = await supabaseAdmin
        .from('billing_events')
        .select('id, status')
        .eq('metadata->>payment_id', paymentStr)
        .maybeSingle();

      if (searchError) {
        console.error('[BillingEngine] Erro ao verificar idempotência:', searchError);
        throw searchError;
      }

      if (existingEvent) {
        console.log(`[BillingEngine] [payment_ignored_duplicate] Pagamento ${paymentStr} duplicado. Ignorando.`);
        // Emite obrigatoriamente: payment_ignored_duplicate
        await supabaseAdmin.from('events').insert([{
          user_id: userId,
          event_type: 'payment_ignored_duplicate',
          metadata: { payment_id: paymentStr }
        }]);
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
          console.log(`[BillingEngine] [payment_ignored_duplicate] Concorrência detectada. Ignorando.`);
          await supabaseAdmin.from('events').insert([{
            user_id: userId,
            event_type: 'payment_ignored_duplicate',
            metadata: { payment_id: paymentStr }
          }]);
          return { success: true, duplicated: true };
        }
        throw insertEventError;
      }

      // Emite obrigatoriamente: payment_approved
      await supabaseAdmin.from('events').insert([{
        user_id: userId,
        event_type: 'payment_approved',
        metadata: {
          payment_id: paymentStr,
          amount: paymentData.transaction_amount || 14.90,
          date_approved: paymentData.date_approved || new Date().toISOString()
        }
      }]);

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
      const updatedProfile = await this.setUserPremium(userId, customerId, expiresAt);

      // 6. Loop de reativação (Recovery & Reactivation Loop)
      if (wasCanceled) {
        await this.handleUserReactivated(userId, paymentStr);
      } else {
        await sendPushNotification(userId, "Pagamento confirmado", "Sua assinatura MyFlowDay Premium foi confirmada com sucesso! ⚡");
      }

      return { success: true, duplicated: false, profile: updatedProfile };
    } catch (err) {
      console.error(`[BillingEngine] Erro ao processar pagamento aprovado ${paymentStr}:`, err.message);
      throw err;
    }
  },

  /**
   * Processa pagamento cancelado.
   * Emite obrigatoriamente: payment_failed.
   */
  async handlePaymentCanceled(userId) {
    console.log(`[BillingEngine] Pagamento cancelado ou devolvido para usuário ${userId}`);
    
    // Emite obrigatoriamente: payment_failed
    await supabaseAdmin.from('events').insert([{
      user_id: userId,
      event_type: 'payment_failed',
      metadata: { reason: 'payment_canceled' }
    }]);

    const updatedProfile = await this.setUserFree(userId);
    await sendPushNotification(userId, "Assinatura cancelada", "Sua assinatura foi cancelada. Seu plano premium foi encerrado.");
    return { success: true, profile: updatedProfile };
  },

  /**
   * Processa assinatura com pagamento pendente/atrasado (Invalida premium).
   * Emite obrigatoriamente: payment_failed e past_due.
   */
  async handlePaymentPastDue(userId) {
    if (!userId) throw new Error('[BillingEngine.handlePaymentPastDue] userId é obrigatório');

    console.log(`[BillingEngine] Assinatura em atraso (past_due) para o usuário ${userId}. Status: PAST_DUE.`);

    // Emite obrigatoriamente: payment_failed
    await supabaseAdmin.from('events').insert([{
      user_id: userId,
      event_type: 'payment_failed',
      metadata: { reason: 'past_due' }
    }]);

    // 1. Atualizar profiles no Supabase (status PAST_DUE, plano free)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        plano: 'free',
        assinatura_status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[BillingEngine.handlePaymentPastDue] Erro ao atualizar perfil:', error);
      throw error;
    }

    // Update subscriptions table (Analytical Source of Truth)
    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: userId,
        status: 'past_due',
        plan: 'premium',
        price: 14.90,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (subError) {
      console.error('[BillingEngine.handlePaymentPastDue] Erro ao atualizar subscriptions:', subError);
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

    return { success: true, profile: data };
  },

  /**
   * Corrige inconsistências identificadas pelo Job de Reconciliação (Anti-drift System).
   * Emite obrigatoriamente: reconciliation_fix_applied.
   */
  async handleReconciliationFix(userId, targetPlan, targetStatus, customerId, expiresAt, reason) {
    if (!userId) throw new Error('[BillingEngine.handleReconciliationFix] userId é obrigatório');

    const normalizedStatus = targetStatus.toLowerCase();
    console.log(`[BillingEngine] [reconciliation_fix_applied] Corrigindo drift para user ${userId}. Motivo: ${reason}.`);

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

      if (error) throw error;
      data = updated;

      // Update subscriptions table (Analytical Source of Truth)
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id: userId,
          status: normalizedStatus === 'active' ? 'active' : 'canceled',
          plan: 'premium',
          price: 14.90,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (subError) {
        console.error('[BillingEngine.handleReconciliationFix] Erro ao atualizar subscriptions:', subError);
      }

      // Gravar evento de downgrade por reconciliação: user_downgraded
      await supabaseAdmin.from('events').insert([{
        user_id: userId,
        event_type: 'user_downgraded',
        metadata: { plano: targetPlan, status: normalizedStatus, reason }
      }]);
    }

    // 2. Gravar o log obrigatório de correção de faturamento: reconciliation_fix_applied (drift_resolved)
    await supabaseAdmin.from('events').insert([{
      user_id: userId,
      event_type: 'reconciliation_fix_applied',
      metadata: {
        target_plan: targetPlan,
        target_status: normalizedStatus,
        reason
      }
    }]);

    return data;
  },

  /**
   * Integração Churn Engine: Trata a detecção de risco de churn no usuário.
   * Não altera o estado do faturamento, apenas sugere risco.
   */
  async handleChurnRiskDetected(userId, riskLevel, churnScore) {
    if (!userId) throw new Error('[BillingEngine.handleChurnRiskDetected] userId é obrigatório');

    console.log(`[BillingEngine] Risco de Churn avaliado para user ${userId}. Nível: ${riskLevel}, Score: ${churnScore}`);

    let retentionAction = 'none';
    if (riskLevel === 'high') {
      retentionAction = 'paywall_retention_discount';
    } else if (riskLevel === 'medium') {
      retentionAction = 'retention_push_notification';
    }

    // Registrar ação de retenção sugerida no banco
    const { error } = await supabaseAdmin
      .from('events')
      .insert([{
        user_id: userId,
        event_type: 'retention_action_triggered',
        metadata: {
          risk_level: riskLevel,
          churn_score: churnScore,
          action: retentionAction,
          timestamp: new Date().toISOString()
        }
      }]);

    if (error) {
      console.warn('[BillingEngine] Erro ao registrar ação de retenção:', error.message);
    }

    return { riskLevel, churnScore, retentionAction };
  },

  /**
   * Recuperação de Usuário Cancelado (Reactivation Loop).
   * Emite obrigatoriamente: user_reactivated e subscription_recovered.
   */
  async handleUserReactivated(userId, paymentId) {
    if (!userId) throw new Error('[BillingEngine.handleUserReactivated] userId é obrigatório');

    console.log(`[BillingEngine] [user_reactivated] Usuário ${userId} reativado com sucesso.`);

    // Gravar logs analíticos de reativação e recuperação
    await supabaseAdmin.from('events').insert([{
      user_id: userId,
      event_type: 'user_reactivated',
      metadata: { payment_id: paymentId, recovered_at: new Date().toISOString() }
    }]);

    await supabaseAdmin.from('events').insert([{
      user_id: userId,
      event_type: 'subscription_recovered',
      metadata: { payment_id: paymentId, recovered_at: new Date().toISOString() }
    }]);

    await sendPushNotification(userId, "Assinatura reativada", "Sua assinatura foi reativada com sucesso! Bem-vindo de volta! ⚡");
  }
};
