// Vercel Serverless Function: /api/billing/reconcile.js

import { supabaseAdmin } from '../../lib/supabase.js';
import { runReconciliation } from '../../jobs/payment-reconciliation.js';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!MERCADOPAGO_ACCESS_TOKEN) {
  throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
}
const CRON_SECRET = process.env.CRON_SECRET || "flowday-cron-secret-1234";

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

  try {
    const result = await runReconciliation();
    console.log('[Reconcile Cron] Auditoria finalizada. Resultados:', result);

    res.status(200).json({
      success: result.success,
      paymentsAudited: result.paymentsAudited,
      subscriptionsAudited: result.subscriptionsAudited,
      discrepanciesFixed: result.fixedCount,
      errors: []
    });
  } catch (error) {
    console.error('[Reconcile Cron] Erro grave durante reconciliação:', error);
    res.status(500).json({
      error: 'Erro interno ao executar reconciliação.',
      message: error.message
    });
  }
}
