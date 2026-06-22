// Vercel Serverless Function: /api/billing/reconcile.js

import { supabaseAdmin } from '../../lib/supabase.js';
import { BillingEngine } from '../../services/billing-engine.js';
import { AccessDecisionEngine } from '../../services/access-decision-engine.js';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || "TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165";
const CRON_SECRET = process.env.CRON_SECRET || "flowday-cron-secret-1234";

export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verificar proteção contra chamadas não autorizadas (Cron Security)
  const authHeader = req.headers.authorization;
  const querySecret = req.query.secret;
  
  const providedSecret = authHeader ? authHeader.replace('Bearer ', '').trim() : querySecret;

  if (providedSecret !== CRON_SECRET) {
    console.warn('[Reconcile Cron] Tentativa de execução não autorizada.');
    res.status(401).json({ error: 'Não autorizado. Chave secreta inválida.' });
    return;
  }

  console.log('[Reconcile Cron] Iniciando auditoria periódica de faturamento (Anti-drift)...');

  // Gravar evento de observabilidade: consistency_check_run
  try {
    await supabaseAdmin.from('events').insert([{
      event_type: 'consistency_check_run',
      metadata: { timestamp: new Date().toISOString(), trigger: 'cron_job' }
    }]);
  } catch (logErr) {
    console.warn('[Reconcile Cron] Falha ao registrar log consistency_check_run:', logErr.message);
  }

  const results = {
    paymentsAudited: 0,
    subscriptionsAudited: 0,
    discrepanciesFixed: 0,
    errors: []
  };

  try {
    // ----------------------------------------------------
    // PASSO 1: Reconciliar Pagamentos Aprovados (Webhook Recovery)
    // ----------------------------------------------------
    const paymentsResponse = await fetch('https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=50', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (paymentsResponse.ok) {
      const paymentsData = await paymentsResponse.json();
      const payments = paymentsData.results || [];
      results.paymentsAudited = payments.length;

      for (const payment of payments) {
        const paymentId = payment.id;
        const status = payment.status;
        const userId = payment.metadata && payment.metadata.user_id;
        const customerId = payment.payer && payment.payer.id;

        if (status === 'approved' && userId) {
          try {
            // Consultar Supabase
            const { data: profile, error: dbError } = await supabaseAdmin
              .from('profiles')
              .select('id, plano, assinatura_status, assinatura_expira_em')
              .eq('id', userId)
              .maybeSingle();

            if (dbError) throw dbError;

            // Utilizar o AccessDecisionEngine para avaliar se o acesso local é Pro
            const decision = AccessDecisionEngine.evaluateAccess(profile);

            // Se o pagamento está aprovado, mas o usuário NÃO tem acesso Pro ativo (Divergência / Drift)
            if (!profile || !decision.isPro) {
              console.log(`[Reconcile Cron] Drift detectado no pagamento ${paymentId} do user ${userId}. Corrigindo...`);

              // Gravar evento de drift: consistency_violation_detected (drift_detected)
              await supabaseAdmin.from('events').insert([{
                user_id: userId,
                event_type: 'consistency_violation_detected',
                metadata: {
                  drift_type: 'payment_approved_but_inactive',
                  payment_id: paymentId,
                  profile_status: profile?.assinatura_status || 'none',
                  profile_plan: profile?.plano || 'none',
                  timestamp: new Date().toISOString()
                }
              }]);

              // Corrigir via handlePaymentApproved (grava em billing_events e atualiza perfil)
              await BillingEngine.handlePaymentApproved(userId, customerId, paymentId, payment);

              // Gravar evento de correção resolvida: reconciliation_fix_applied (drift_resolved)
              await BillingEngine.handleReconciliationFix(
                userId, 
                'premium', 
                'active', 
                customerId, 
                payment.date_of_expiration || null, 
                `Anti-Drift webhook recovery: Pagamento aprovado ${paymentId} não havia liberado acesso Pro.`
              );

              results.discrepanciesFixed++;
            }
          } catch (err) {
            console.error(`[Reconcile Cron] Erro ao reconciliar pagamento ${paymentId}:`, err.message);
            results.errors.push({ type: 'payment', id: paymentId, message: err.message });
          }
        }
      }
    } else {
      const errText = await paymentsResponse.text();
      console.error('[Reconcile Cron] Erro ao buscar pagamentos no MP:', errText);
      results.errors.push({ type: 'mp_payments_fetch', message: errText });
    }

    // ----------------------------------------------------
    // PASSO 2: Reconciliar Assinaturas Recorrentes (Downgrade e Expiração)
    // ----------------------------------------------------
    const preapprovalsResponse = await fetch('https://api.mercadopago.com/preapproval/search?limit=50', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (preapprovalsResponse.ok) {
      const preapprovalsData = await preapprovalsResponse.json();
      const subscriptions = preapprovalsData.results || [];
      results.subscriptionsAudited = subscriptions.length;

      for (const sub of subscriptions) {
        const subId = sub.id;
        const status = sub.status; // 'authorized' (ativo), 'paused', 'cancelled', etc.
        const userId = sub.external_reference || (sub.metadata && sub.metadata.user_id);
        const customerId = sub.payer_id;

        if (userId) {
          try {
            // Buscar perfil no Supabase
            const { data: profile, error: dbError } = await supabaseAdmin
              .from('profiles')
              .select('id, plano, assinatura_status, assinatura_expira_em')
              .eq('id', userId)
              .maybeSingle();

            if (dbError) throw dbError;

            const decision = AccessDecisionEngine.evaluateAccess(profile);

            // Se a assinatura no MP está cancelada/inativa, mas o Supabase indica que o usuário é Pro (Drift)
            if (status !== 'authorized' && profile && decision.isPro) {
              console.log(`[Reconcile Cron] Drift detectado: Assinatura MP inativa (${status}) mas Pro ativo no Supabase para user ${userId}. Corrigindo...`);

              // Gravar evento de drift: consistency_violation_detected (drift_detected)
              await supabaseAdmin.from('events').insert([{
                user_id: userId,
                event_type: 'consistency_violation_detected',
                metadata: {
                  drift_type: 'mp_subscription_inactive_but_profile_active',
                  subscription_id: subId,
                  mp_status: status,
                  profile_status: profile.assinatura_status,
                  timestamp: new Date().toISOString()
                }
              }]);

              // Aplicar downgrade automático
              await BillingEngine.handleReconciliationFix(
                userId, 
                'free', 
                'canceled', 
                customerId, 
                null, 
                `Anti-Drift downgrade: Assinatura recorrente ${subId} inativa no Mercado Pago (Status: ${status}).`
              );

              results.discrepanciesFixed++;
            }
          } catch (err) {
            console.error(`[Reconcile Cron] Erro ao reconciliar assinatura ${subId}:`, err.message);
            results.errors.push({ type: 'subscription', id: subId, message: err.message });
          }
        }
      }
    } else {
      const errText = await preapprovalsResponse.text();
      console.error('[Reconcile Cron] Erro ao buscar preapprovals no MP:', errText);
      results.errors.push({ type: 'mp_preapprovals_fetch', message: errText });
    }

    console.log('[Reconcile Cron] Auditoria finalizada. Resultados:', results);
    res.status(200).json({ 
      success: true, 
      ...results 
    });
  } catch (error) {
    console.error('[Reconcile Cron] Erro grave durante reconciliação:', error);
    res.status(500).json({ 
      error: 'Erro interno ao executar reconciliação.', 
      message: error.message 
    });
  }
}
