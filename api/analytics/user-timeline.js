// Vercel Serverless Function: /api/analytics/user-timeline.js

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
  const targetUserId = req.method === 'GET' ? req.query.targetUserId : req.body?.targetUserId;

  if (!userId) {
    res.status(400).json({ error: 'userId é obrigatório.' });
    return;
  }

  if (!targetUserId) {
    res.status(400).json({ error: 'targetUserId é obrigatório.' });
    return;
  }

  try {
    // 1. Validar se o usuário solicitante é administrador
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (authError || !user) {
      console.warn(`[API User Timeline] Acesso negado para user ${userId}: usuário não encontrado.`);
      res.status(403).json({ error: 'Acesso negado. Usuário não encontrado ou não autorizado.' });
      return;
    }

    const email = user.email || '';
    const isAdmin = ['admin@flowday.app', 'rafaelle@flowday.app', 'rafox@flowday.app'].includes(email.toLowerCase()) || 
                    user.user_metadata?.is_admin === true;

    if (!isAdmin) {
      console.warn(`[API User Timeline] Acesso negado para user ${userId} (${email}). Não é administrador.`);
      res.status(403).json({ error: 'Acesso negado. Apenas administradores podem acessar este recurso.' });
      return;
    }

    // 2. Buscar a timeline detalhada do usuário alvo
    const timelineData = await RevenueAnalyticsService.getUserTimeline(targetUserId);

    if (!timelineData) {
      res.status(404).json({ error: 'Perfil do usuário alvo não encontrado.' });
      return;
    }

    res.status(200).json(timelineData);
  } catch (error) {
    console.error(`[API User Timeline] Erro ao carregar timeline de ${targetUserId} para ${userId}:`, error);
    res.status(500).json({ error: 'Erro crítico interno ao carregar a timeline do usuário.', message: error.message });
  }
}
