// Vercel Serverless Function: /api/auth/check-access.js
// Mantido para compatibilidade legado, delegando autoridade de decisão ao AccessDecisionEngine

import { supabaseAdmin } from '../../lib/supabase.js';
import { AccessDecisionEngine } from '../../services/access-decision-engine.js';
import { ChurnEngine } from '../../services/churn-engine.js';
import { BillingEngine } from '../../services/billing-engine.js';

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
    // 1. Buscar perfil
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('plano, assinatura_status, assinatura_expira_em')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) {
      res.status(200).json({ isPro: false, reason: 'INVALID', error: 'Perfil não encontrado.' });
      return;
    }

    // 2. Delegar ao AccessDecisionEngine
    const decision = AccessDecisionEngine.evaluateAccess(profile);

    // 3. Registrar logs estruturados
    await supabaseAdmin.from('events').insert([{
      user_id: userId,
      event_type: 'access_decision_evaluated',
      metadata: {
        isPro: decision.isPro,
        reason: decision.reason,
        plano: profile.plano,
        status: profile.assinatura_status,
        expiresAt: profile.assinatura_expira_em,
        timestamp: new Date().toISOString()
      }
    }]);

    const auditEvent = decision.isPro ? 'access_granted' : 'access_denied_reason';
    await supabaseAdmin.from('events').insert([{
      user_id: userId,
      event_type: auditEvent,
      metadata: { reason: decision.reason, timestamp: new Date().toISOString() }
    }]);

    // 4. Rodar Churn Engine
    let churnData = null;
    try {
      churnData = await ChurnEngine.calculateChurnScore(userId);
      await BillingEngine.handleChurnRiskDetected(userId, churnData.risk, churnData.score);
    } catch (churnErr) {
      console.warn(`[API Legacy Check-Access] Falha no Churn Engine para user ${userId}:`, churnErr.message);
    }

    res.status(200).json({ 
      isPro: decision.isPro,
      plano: profile.plano,
      status: decision.reason,
      expiresAt: profile.assinatura_expira_em,
      churn: churnData ? {
        score: churnData.score,
        risk: churnData.risk
      } : null
    });

  } catch (error) {
    console.error(`[API Legacy Check-Access] Erro:`, error);
    res.status(200).json({ isPro: false, reason: 'INVALID', error: error.message });
  }
}
