// Vercel Serverless Function: /api/analytics/revenue.js

import { supabaseAdmin } from '../../lib/supabase.js';
import { RevenueAnalyticsService } from '../../services/revenue-analytics-service.js';

export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    res.status(400).json({ error: 'userId é obrigatório.' });
    return;
  }

  try {
    // 1. Validar se o usuário solicitante é administrador
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (authError || !user) {
      console.warn(`[API Analytics Revenue] Acesso negado para user ${userId}: usuário não encontrado.`);
      res.status(403).json({ error: 'Acesso negado. Usuário não encontrado ou não autorizado.' });
      return;
    }

    const email = user.email || '';
    const isAdmin = ['admin@flowday.app', 'rafaelle@flowday.app', 'rafox@flowday.app'].includes(email.toLowerCase()) || 
                    user.user_metadata?.is_admin === true;

    if (!isAdmin) {
      console.warn(`[API Analytics Revenue] Acesso negado para user ${userId} (${email}). Não é administrador.`);
      res.status(403).json({ error: 'Acesso negado. Apenas administradores podem acessar este recurso.' });
      return;
    }

    // 2. Buscar as métricas financeiras consolidadas
    const metrics = await RevenueAnalyticsService.getRevenueMetrics();

    res.status(200).json(metrics);
  } catch (error) {
    console.error(`[API Analytics Revenue] Erro ao consolidar métricas para user ${userId}:`, error);
    res.status(500).json({ error: 'Erro crítico interno ao carregar analytics.', message: error.message });
  }
}
