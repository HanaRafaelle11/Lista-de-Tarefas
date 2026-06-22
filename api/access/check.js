// Vercel Serverless Function: /api/access/check.js

import { supabaseAdmin } from '../../lib/supabase.js';
import { AccessDecisionEngine } from '../../services/access-decision-engine.js';
import { ChurnEngine } from '../../services/churn-engine.js';
import { BillingEngine } from '../../services/billing-engine.js';

export default async function handler(req, res) {
  // CORS Configuration
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // preflight pre-response
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const userId = req.method === 'GET' ? req.query.userId : req.body?.userId;

  if (!userId) {
    res.status(200).json({ isPro: false, reason: 'INVALID', error: 'userId não fornecido.' });
    return;
  }

  try {
    // 1. Buscar assinatura do usuário no Supabase
    const { data: subscription, error } = await supabaseAdmin
      .from('subscriptions')
      .select('status, current_period_end, plan')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error(`[API Access Check] Erro ao consultar Supabase para user ${userId}:`, error.message);
      res.status(200).json({ isPro: false, reason: 'INVALID', error: 'Erro ao carregar dados da assinatura.' });
      return;
    }

    // 2. Determinar o veredito via AccessDecisionEngine (Fonte Absoluta de Verdade)
    const decision = AccessDecisionEngine.evaluateAccess(subscription);

    // 3. Registrar logs estruturados de auditoria (Observabilidade)
    // Evento Geral de Avaliação
    await supabaseAdmin.from('events').insert([{
      user_id: userId,
      event_type: 'access_decision_evaluated',
      metadata: {
        isPro: decision.isPro,
        reason: decision.reason,
        plano: subscription?.plan || 'free',
        status: subscription?.status || 'free',
        expiresAt: subscription?.current_period_end || null,
        timestamp: new Date().toISOString()
      }
    }]);

    // Evento de Concedido vs Negado com motivo
    const auditEvent = decision.isPro ? 'access_granted' : 'access_denied_reason';
    await supabaseAdmin.from('events').insert([{
      user_id: userId,
      event_type: auditEvent,
      metadata: {
        reason: decision.reason,
        timestamp: new Date().toISOString()
      }
    }]);

    // 4. Disparar a reavaliação de Churn em background (Churn Engine apenas sugere risco)
    let churnData = null;
    try {
      churnData = await ChurnEngine.calculateChurnScore(userId);
      await BillingEngine.handleChurnRiskDetected(userId, churnData.risk, churnData.score);
    } catch (churnErr) {
      console.warn(`[API Access Check] Falha não-bloqueante no Churn Engine para user ${userId}:`, churnErr.message);
    }

    console.log(`[API Access Check] Auditoria user ${userId}: isPro = ${decision.isPro} (${decision.reason}). Churn: ${churnData?.score || 0}`);

    res.status(200).json({ 
      isPro: decision.isPro,
      plano: subscription?.plan || 'free',
      status: decision.reason,
      expiresAt: subscription?.current_period_end || null,
      churn: churnData ? {
        score: churnData.score,
        risk: churnData.risk
      } : null
    });

  } catch (error) {
    console.error(`[API Access Check] Erro crítico para user ${userId}:`, error);
    res.status(200).json({ 
      isPro: false, 
      reason: 'INVALID',
      error: 'Erro crítico interno ao verificar acesso.',
      message: error.message 
    });
  }
}
