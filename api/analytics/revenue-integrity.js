// Vercel Serverless Function: /api/analytics/revenue-integrity.js

import { supabaseAdmin } from '../../lib/supabase.js';
import { RevenueIntegrityService } from '../../services/revenue-integrity-service.js';

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

  // preflight OPTIONS
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
    res.status(400).json({ error: 'userId é obrigatório.' });
    return;
  }

  try {
    // 1. Validar se o usuário solicitante é administrador
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (authError || !user) {
      console.warn(`[API Analytics Revenue Integrity] Acesso negado para user ${userId}: usuário não encontrado.`);
      res.status(403).json({ error: 'Acesso negado. Usuário não encontrado ou não autorizado.' });
      return;
    }

    const email = user.email || '';
    const isAdmin = ['admin@flowday.app', 'rafaelle@flowday.app', 'rafox@flowday.app'].includes(email.toLowerCase()) || 
                    user.user_metadata?.is_admin === true;

    if (!isAdmin) {
      console.warn(`[API Analytics Revenue Integrity] Acesso negado para user ${userId} (${email}). Não é administrador.`);
      res.status(403).json({ error: 'Acesso negado. Apenas administradores podem acessar este recurso.' });
      return;
    }

    // 2. Coletar métricas do RevenueIntegrityService
    const mrr = await RevenueIntegrityService.calculateMRR();
    const churnRate = await RevenueIntegrityService.calculateChurnRate();
    const leakage = await RevenueIntegrityService.detectRevenueLeakage();
    const cohorts = await RevenueIntegrityService.getCohortTracking();

    res.status(200).json({
      success: true,
      metrics: {
        mrr,
        churnRate,
        leakageCount: leakage.length,
        cohortCount: cohorts.length
      },
      leakage,
      cohorts
    });
  } catch (error) {
    console.error(`[API Analytics Revenue Integrity] Erro ao carregar métricas para user ${userId}:`, error);
    res.status(500).json({ error: 'Erro crítico interno ao carregar faturamento e integridade.', message: error.message });
  }
}
