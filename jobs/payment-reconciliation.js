import { supabaseAdmin } from '../lib/supabase.js';
import { BillingEngine } from '../services/billing-engine.js';
import { PaymentStateMachine } from '../services/payment-state-machine.js';
import { SubscriptionStateMachine } from '../services/subscription-state-machine.js';
import { DistributedLock } from '../services/distributed-lock.js';
import { RetryEngine } from '../services/retry-engine.js';
import { BillingTracer, BillingLogger } from '../services/billing-tracer.js';
import { EventOrderingEngine } from '../services/event-ordering-engine.js';
import { ChaosEngine } from '../services/chaos-engine.js';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

function normalizeStatus(mpStatus) {
  const mapping = {
    approved: 'approved',
    pending: 'pending',
    in_process: 'in_process',
    authorized: 'approved',
    in_mediation: 'pending_review',
    rejected: 'rejected',
    cancelled: 'cancelled',
    refunded: 'refunded',
    charged_back: 'refunded'
  };
  return mapping[mpStatus] || mpStatus || 'pending';
}

export async function runReconciliation() {
  if (!MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error("[Reconciliation] MERCADOPAGO_ACCESS_TOKEN não configurado");
  }

  // Wrap the entire job in a trace context
  return await BillingTracer.runWithTrace(null, async () => {
    BillingLogger.info('reconciliation_started', null, null);
    let fixedCount = 0;

    // --- CENÁRIO A: Auditar pagamentos pendentes/in_process locais ---
    const { data: pendingPayments, error: dbError } = await supabaseAdmin
      .from('payment_events')
      .select('payment_id, status, user_id')
      .in('status', ['created', 'pending', 'in_process']);

    if (dbError) {
      BillingLogger.error('reconciliation_fetch_pending_failed', null, null, dbError);
      return { success: false, error: dbError.message };
    }

    // --- CENÁRIO B: Buscar pagamentos recentes do Mercado Pago ---
    let mpPayments = [];
    try {
      mpPayments = await RetryEngine.execute(async () => {
        await ChaosEngine.triggerFailureIfEnabled('mp_timeout', 'Mercado Pago search API timeout');

        const mpSearchResponse = await fetch('https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=50', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        if (!mpSearchResponse.ok) {
          const errText = await mpSearchResponse.text().catch(() => '');
          throw new Error(`MP Search API failed: ${errText}`);
        }

        const searchData = await mpSearchResponse.json();
        return searchData.results || [];
      }, {
        maxRetries: 3,
        operationName: 'mp_reconciliation_search'
      });
    } catch (err) {
      BillingLogger.error('reconciliation_mp_search_failed', null, null, err);
    }

    // Unificar IDs de pagamentos a serem verificados
    const paymentIdsToCheck = new Set([
      ...(pendingPayments || []).map(p => String(p.payment_id)),
      ...mpPayments.map(p => String(p.id))
    ]);

    BillingLogger.info('reconciliation_payments_analyzing', null, null, { count: paymentIdsToCheck.size });

    for (const paymentId of paymentIdsToCheck) {
      try {
        // 1. Obter estado local do pagamento
        const { data: localEvent } = await supabaseAdmin
          .from('payment_events')
          .select('status, user_id')
          .eq('payment_id', paymentId)
          .maybeSingle();

        // 2. Obter detalhes do pagamento do Mercado Pago
        let paymentDetails = mpPayments.find(p => String(p.id) === paymentId);
        if (!paymentDetails) {
          if (paymentId.startsWith('sim_') || paymentId.includes('mock')) {
            let status = 'approved';
            if (paymentId.includes('rejected')) status = 'rejected';
            else if (paymentId.includes('pending')) status = 'pending';
            else if (paymentId.includes('cancelled')) status = 'cancelled';
            else if (paymentId.includes('refunded')) status = 'refunded';

            paymentDetails = {
              id: paymentId,
              status: status,
              transaction_amount: 14.90,
              date_approved: new Date().toISOString(),
              date_last_updated: new Date().toISOString(),
              metadata: { user_id: localEvent?.user_id || '00000000-0000-0000-0000-000000000009' },
              payer: { id: 'mock_reconcile_123', email: 'reconcile_test@flowday.app' }
            };
          } else {
            try {
              paymentDetails = await RetryEngine.execute(async () => {
                await ChaosEngine.triggerFailureIfEnabled('mp_timeout', 'Mercado Pago single fetch timeout');

                const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                  }
                });
                if (!mpResponse.ok) {
                  throw new Error(`MP fetch status ${mpResponse.status}`);
                }
                return await mpResponse.json();
              }, {
                maxRetries: 3,
                operationName: 'mp_reconciliation_fetch_payment',
                paymentId
              });
            } catch (fetchErr) {
              BillingLogger.error('reconciliation_mp_fetch_failed', paymentId, null, fetchErr);
            }
          }
        }

        if (!paymentDetails) continue;

        const rawStatus = paymentDetails.status;
        const normalizedStatus = normalizeStatus(rawStatus);
        const userId = paymentDetails.metadata?.user_id || localEvent?.user_id;

        if (!userId) continue;

        const lockKey = `subscription:${userId}`;

        // Wrap execution in lock
        await DistributedLock.withLock(lockKey, async () => {
          const currentLocalStatus = localEvent?.status || null;
          const eventTimestamp = paymentDetails.date_last_updated || paymentDetails.date_approved || new Date().toISOString();

          // Check event ordering to prevent regression
          const isOutOfOrder = await EventOrderingEngine.isEventOutOfOrder(userId, eventTimestamp);
          if (isOutOfOrder) {
            BillingLogger.info('reconciliation_event_ignored_outoforder', paymentId, null, { userId, eventTimestamp });
            return;
          }

          if (normalizedStatus !== currentLocalStatus) {
            if (normalizedStatus === 'approved') {
              if (PaymentStateMachine.isValidTransition(currentLocalStatus, 'approved')) {
                await supabaseAdmin.from('events').insert([{
                  user_id: userId,
                  event_type: 'consistency_violation_detected',
                  metadata: {
                    drift_type: 'payment_approved_but_inactive',
                    payment_id: paymentId,
                    profile_status: currentLocalStatus || 'none',
                    timestamp: new Date().toISOString()
                  }
                }]);

                if (!currentLocalStatus) {
                  await supabaseAdmin.from('payment_ledger').insert([{
                    payment_id: paymentId,
                    event_type: 'payment_created',
                    status_raw: 'created',
                    status_normalized: 'created',
                    user_id: userId,
                    payload: paymentDetails
                  }]);

                  await supabaseAdmin.from('payment_events').insert([{
                    payment_id: paymentId,
                    status: 'created',
                    user_id: userId,
                    plan: 'premium',
                    processed_at: new Date().toISOString()
                  }]);
                }

                PaymentStateMachine.transition(currentLocalStatus || 'created', 'approved');

                await supabaseAdmin
                  .from('payment_events')
                  .update({ status: 'approved', processed_at: new Date().toISOString() })
                  .eq('payment_id', paymentId);

                await supabaseAdmin.from('payment_ledger').insert([{
                  payment_id: paymentId,
                  event_type: 'status_updated',
                  status_raw: rawStatus,
                  status_normalized: 'approved',
                  user_id: userId,
                  payload: paymentDetails
                }]);

                const customerId = paymentDetails.payer?.id || null;
                await BillingEngine.handlePaymentApproved(userId, customerId, paymentId, paymentDetails);

                PaymentStateMachine.transition('approved', 'reconciled');

                await supabaseAdmin
                  .from('payment_events')
                  .update({ status: 'reconciled', processed_at: new Date().toISOString() })
                  .eq('payment_id', paymentId);

                await supabaseAdmin.from('payment_ledger').insert([{
                  payment_id: paymentId,
                  event_type: 'reconciled',
                  status_raw: rawStatus,
                  status_normalized: 'reconciled',
                  user_id: userId,
                  payload: paymentDetails
                }]);

                await supabaseAdmin.from('events').insert([{
                  user_id: userId,
                  event_type: 'reconciliation_fix_applied',
                  metadata: {
                    drift_type: 'payment_approved_but_inactive',
                    payment_id: paymentId,
                    description: `Anti-Drift webhook recovery: Pagamento aprovado ${paymentId} não havia liberado acesso Pro.`
                  }
                }]);

                await BillingTracer.recordTrace({
                  paymentId,
                  userId,
                  eventType: 'reconciliation_fix_payment_approved',
                  stateBefore: currentLocalStatus || 'none',
                  stateAfter: 'reconciled',
                  source: 'reconciliation'
                });

                fixedCount++;
              }
            } else if (['rejected', 'cancelled', 'refunded'].includes(normalizedStatus)) {
              if (PaymentStateMachine.isValidTransition(currentLocalStatus, normalizedStatus)) {
                if (!currentLocalStatus) {
                  await supabaseAdmin.from('payment_ledger').insert([{
                    payment_id: paymentId,
                    event_type: 'payment_created',
                    status_raw: 'created',
                    status_normalized: 'created',
                    user_id: userId,
                    payload: paymentDetails
                  }]);

                  await supabaseAdmin.from('payment_events').insert([{
                    payment_id: paymentId,
                    status: 'created',
                    user_id: userId,
                    plan: 'premium',
                    processed_at: new Date().toISOString()
                  }]);
                }

                PaymentStateMachine.transition(currentLocalStatus || 'created', normalizedStatus);

                await supabaseAdmin
                  .from('payment_events')
                  .update({ status: normalizedStatus, processed_at: new Date().toISOString() })
                  .eq('payment_id', paymentId);

                await supabaseAdmin.from('payment_ledger').insert([{
                  payment_id: paymentId,
                  event_type: 'status_updated',
                  status_raw: rawStatus,
                  status_normalized: normalizedStatus,
                  user_id: userId,
                  payload: paymentDetails
                }]);

                await BillingEngine.handlePaymentCanceled(userId);

                await BillingTracer.recordTrace({
                  paymentId,
                  userId,
                  eventType: 'reconciliation_fix_payment_failed',
                  stateBefore: currentLocalStatus || 'none',
                  stateAfter: normalizedStatus,
                  source: 'reconciliation'
                });

                fixedCount++;
              }
            }
          } else if (currentLocalStatus === 'approved') {
            if (PaymentStateMachine.isValidTransition('approved', 'reconciled')) {
              PaymentStateMachine.transition('approved', 'reconciled');

              await supabaseAdmin
                .from('payment_events')
                .update({ status: 'reconciled', processed_at: new Date().toISOString() })
                .eq('payment_id', paymentId);

              await supabaseAdmin.from('payment_ledger').insert([{
                payment_id: paymentId,
                event_type: 'reconciled',
                status_raw: rawStatus,
                status_normalized: 'reconciled',
                user_id: userId,
                payload: paymentDetails
              }]);

              await BillingTracer.recordTrace({
                paymentId,
                userId,
                eventType: 'reconciliation_confirm_approved',
                stateBefore: 'approved',
                stateAfter: 'reconciled',
                source: 'reconciliation'
              });

              fixedCount++;
            }
          }
        });
      } catch (err) {
        BillingLogger.error('reconciliation_payment_failed', paymentId, null, err);
      }
    }

    // --- CENÁRIO C: Reconciliar Assinaturas Recorrentes (Preapproval) ---
    BillingLogger.info('reconciliation_preapprovals_started', null, null);
    let subscriptionsAudited = 0;

    let remoteSubs = [];
    try {
      remoteSubs = await RetryEngine.execute(async () => {
        await ChaosEngine.triggerFailureIfEnabled('mp_timeout', 'Mercado Pago preapprovals search timeout');

        const preapprovalsResponse = await fetch('https://api.mercadopago.com/preapproval/search?limit=50', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        if (!preapprovalsResponse.ok) {
          const errText = await preapprovalsResponse.text().catch(() => '');
          throw new Error(`MP Preapproval search API error: ${errText}`);
        }

        const preapprovalsData = await preapprovalsResponse.json();
        return preapprovalsData.results || [];
      }, {
        maxRetries: 3,
        operationName: 'mp_reconciliation_preapprovals'
      });
    } catch (err) {
      BillingLogger.error('reconciliation_preapprovals_fetch_failed', null, null, err);
    }

    subscriptionsAudited = remoteSubs.length;

    for (const sub of remoteSubs) {
      const subId = sub.id;
      const remoteStatus = sub.status; // 'authorized', 'paused', 'cancelled', etc.
      const userId = sub.external_reference || (sub.metadata && sub.metadata.user_id);
      const customerId = sub.payer_id;

      if (userId) {
        const lockKey = `subscription:${userId}`;

        try {
          await DistributedLock.withLock(lockKey, async () => {
            const { data: localSub, error: localSubErr } = await supabaseAdmin
              .from('subscriptions')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle();

            if (localSubErr) throw localSubErr;

            if (remoteStatus === 'authorized') {
              if (!localSub || localSub.status !== 'active') {
                BillingLogger.info('reconciliation_fixing_inactive_local_sub', null, subId, { userId });

                await supabaseAdmin.from('events').insert([{
                  user_id: userId,
                  event_type: 'consistency_violation_detected',
                  metadata: {
                    drift_type: 'mp_subscription_active_but_local_inactive',
                    subscription_id: subId,
                    mp_status: remoteStatus,
                    local_status: localSub?.status || 'none',
                    timestamp: new Date().toISOString()
                  }
                }]);

                const nextExpiry = new Date();
                nextExpiry.setDate(nextExpiry.getDate() + 30);
                await BillingEngine.setUserPremium(userId, customerId, nextExpiry.toISOString(), subId);

                await supabaseAdmin.from('events').insert([{
                  user_id: userId,
                  event_type: 'reconciliation_fix_applied',
                  metadata: {
                    drift_type: 'mp_subscription_active_but_local_inactive',
                    subscription_id: subId,
                    description: `Reconciliado: Assinatura ativada localmente.`
                  }
                }]);

                await BillingTracer.recordTrace({
                  paymentId: subId,
                  userId,
                  eventType: 'reconciliation_fix_sub_active',
                  stateBefore: localSub?.status || 'none',
                  stateAfter: 'active',
                  source: 'reconciliation'
                });

                fixedCount++;
              }
            } else {
              if (localSub && localSub.status === 'active') {
                BillingLogger.info('reconciliation_fixing_active_local_sub', null, subId, { userId, remoteStatus });

                await supabaseAdmin.from('payment_ledger').insert([{
                  payment_id: subId,
                  event_type: 'subscription_cancelled',
                  status_raw: remoteStatus,
                  status_normalized: 'cancelled',
                  user_id: userId,
                  payload: sub
                }]);

                await supabaseAdmin.from('events').insert([{
                  user_id: userId,
                  event_type: 'consistency_violation_detected',
                  metadata: {
                    drift_type: 'mp_subscription_inactive_but_local_active',
                    subscription_id: subId,
                    mp_status: remoteStatus,
                    local_status: localSub.status,
                    timestamp: new Date().toISOString()
                  }
                }]);

                await BillingEngine.setUserFree(userId, 'canceled');

                await supabaseAdmin.from('events').insert([{
                  user_id: userId,
                  event_type: 'reconciliation_fix_applied',
                  metadata: {
                    drift_type: 'mp_subscription_inactive_but_local_active',
                    subscription_id: subId,
                    description: `Reconciliado: Assinatura cancelada localmente.`
                  }
                }]);

                await BillingTracer.recordTrace({
                  paymentId: subId,
                  userId,
                  eventType: 'reconciliation_fix_sub_cancelled',
                  stateBefore: 'active',
                  stateAfter: 'canceled',
                  source: 'reconciliation'
                });

                fixedCount++;
              }
            }
          });
        } catch (subErr) {
          BillingLogger.error('reconciliation_sub_failed', null, subId, subErr, { userId });
        }
      }
    }

    // --- CENÁRIO D: Detectar pagamento sem assinatura ---
    BillingLogger.info('reconciliation_check_payment_without_sub', null, null);
    const { data: approvedPayments, error: appPayErr } = await supabaseAdmin
      .from('payment_events')
      .select('*')
      .eq('status', 'reconciled');

    if (!appPayErr && approvedPayments) {
      for (const payment of approvedPayments) {
        const lockKey = `subscription:${payment.user_id}`;

        try {
          await DistributedLock.withLock(lockKey, async () => {
            const { data: checkSub } = await supabaseAdmin
              .from('subscriptions')
              .select('id, status')
              .eq('user_id', payment.user_id)
              .maybeSingle();

            if (!checkSub) {
              BillingLogger.info('reconciliation_fixing_payment_without_sub', payment.payment_id, null, { userId: payment.user_id });

              await supabaseAdmin.from('events').insert([{
                user_id: payment.user_id,
                event_type: 'consistency_violation_detected',
                metadata: {
                  drift_type: 'payment_exists_but_no_subscription',
                  payment_id: payment.payment_id,
                  timestamp: new Date().toISOString()
                }
              }]);

              const nextExpiry = new Date(payment.processed_at || new Date());
              nextExpiry.setDate(nextExpiry.getDate() + 30);

              await BillingEngine.setUserPremium(payment.user_id, null, nextExpiry.toISOString(), payment.payment_id);

              await supabaseAdmin.from('events').insert([{
                user_id: payment.user_id,
                event_type: 'reconciliation_fix_applied',
                metadata: {
                  drift_type: 'payment_exists_but_no_subscription',
                  payment_id: payment.payment_id,
                  description: 'Assinatura criada com base em pagamento existente aprovado.'
                }
              }]);

              await BillingTracer.recordTrace({
                paymentId: payment.payment_id,
                userId: payment.user_id,
                eventType: 'reconciliation_fix_create_sub_for_payment',
                stateBefore: 'none',
                stateAfter: 'active',
                source: 'reconciliation'
              });

              fixedCount++;
            }
          });
        } catch (err) {
          BillingLogger.error('reconciliation_payment_without_sub_failed', payment.payment_id, null, err, { userId: payment.user_id });
        }
      }
    }

    // --- CENÁRIO E: Reconciliação Perfil vs Assinaturas (Alinhamento Interno) ---
    BillingLogger.info('reconciliation_align_profile_with_sub', null, null);
    const { data: profilesWithPremium, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, plano, assinatura_status')
      .eq('plano', 'premium');

    if (!profErr && profilesWithPremium) {
      for (const profile of profilesWithPremium) {
        const lockKey = `subscription:${profile.id}`;

        try {
          await DistributedLock.withLock(lockKey, async () => {
            const { data: localSub } = await supabaseAdmin
              .from('subscriptions')
              .select('status')
              .eq('user_id', profile.id)
              .maybeSingle();

            if (!localSub || localSub.status !== 'active') {
              BillingLogger.info('reconciliation_fixing_premium_profile_inactive_sub', null, null, { userId: profile.id, subStatus: localSub?.status });

              await supabaseAdmin.from('events').insert([{
                user_id: profile.id,
                event_type: 'consistency_violation_detected',
                metadata: {
                  drift_type: 'profile_premium_but_subscription_inactive',
                  profile_status: profile.assinatura_status,
                  subscription_status: localSub?.status || 'none',
                  timestamp: new Date().toISOString()
                }
              }]);

              await BillingEngine.setUserFree(profile.id, localSub?.status || 'expired');

              await supabaseAdmin.from('events').insert([{
                user_id: profile.id,
                event_type: 'reconciliation_fix_applied',
                metadata: {
                  drift_type: 'profile_premium_but_subscription_inactive',
                  description: 'Perfil removido de premium para corresponder ao status inativo na tabela subscriptions.'
                }
              }]);

              await BillingTracer.recordTrace({
                paymentId: null,
                userId: profile.id,
                eventType: 'reconciliation_fix_profile_downgrade',
                stateBefore: 'active',
                stateAfter: localSub?.status || 'expired',
                source: 'reconciliation'
              });

              fixedCount++;
            }
          });
        } catch (err) {
          BillingLogger.error('reconciliation_align_profile_failed', null, null, err, { userId: profile.id });
        }
      }
    }

    // --- CENÁRIO F: Detectar assinatura ativa sem pagamento válido ---
    BillingLogger.info('reconciliation_check_active_sub_without_payment', null, null);
    const { data: activeSubscriptions, error: activeSubErr } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('status', 'active');

    if (!activeSubErr && activeSubscriptions) {
      for (const sub of activeSubscriptions) {
        const lockKey = `subscription:${sub.user_id}`;

        try {
          await DistributedLock.withLock(lockKey, async () => {
            const { data: payments } = await supabaseAdmin
              .from('payment_events')
              .select('payment_id')
              .eq('user_id', sub.user_id)
              .eq('status', 'reconciled');

            if (!payments || payments.length === 0) {
              BillingLogger.info('reconciliation_fixing_active_sub_without_payment', null, null, { userId: sub.user_id });

              await supabaseAdmin.from('events').insert([{
                user_id: sub.user_id,
                event_type: 'consistency_violation_detected',
                metadata: {
                  drift_type: 'active_subscription_without_valid_payment',
                  timestamp: new Date().toISOString()
                }
              }]);

              await BillingEngine.handlePaymentPastDue(sub.user_id);

              await supabaseAdmin.from('events').insert([{
                user_id: sub.user_id,
                event_type: 'reconciliation_fix_applied',
                metadata: {
                  drift_type: 'active_subscription_without_valid_payment',
                  description: 'Assinatura ativa sem pagamentos válidos alterada para past_due.'
                }
              }]);

              await BillingTracer.recordTrace({
                paymentId: null,
                userId: sub.user_id,
                eventType: 'reconciliation_fix_active_sub_past_due',
                stateBefore: 'active',
                stateAfter: 'past_due',
                source: 'reconciliation'
              });

              fixedCount++;
            }
          });
        } catch (err) {
          BillingLogger.error('reconciliation_active_sub_without_payment_failed', null, null, err, { userId: sub.user_id });
        }
      }
    }

    BillingLogger.info('reconciliation_finished', null, null, { fixedCount });
    return {
      success: true,
      fixedCount,
      paymentsAudited: paymentIdsToCheck.size,
      subscriptionsAudited
    };
  });
}
