import { supabaseAdmin } from '../../lib/supabase.js';
import { BillingEngine } from '../../lib/billing/engine.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    console.log('[CRON BILLING EXPIRATION] Iniciando verificação de assinaturas expiradas...');
    const now = new Date().toISOString();

    // Buscar assinaturas ativas cujo período de acesso já expirou
    const { data: expiredSubs, error } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, current_period_end, status')
      .eq('status', 'active')
      .lt('current_period_end', now);

    if (error) {
      console.error('[CRON BILLING EXPIRATION DB ERROR]', error);
      return res.status(500).json({ error: true, message: error.message });
    }

    const count = expiredSubs ? expiredSubs.length : 0;
    console.log(`[CRON BILLING EXPIRATION] Encontradas ${count} assinaturas expiradas.`);

    const results = [];
    if (expiredSubs && expiredSubs.length > 0) {
      for (const sub of expiredSubs) {
        try {
          await BillingEngine.processSubscriptionCanceled({
            userId: sub.user_id,
            reason: 'expired'
          });
          results.push({ userId: sub.user_id, status: 'expired' });
        } catch (subErr) {
          console.error(`[CRON BILLING EXPIRATION ERROR for ${sub.user_id}]`, subErr.message);
        }
      }
    }

    return res.status(200).json({
      success: true,
      timestamp: now,
      processedCount: count,
      results
    });
  } catch (err) {
    console.error('[CRON BILLING EXPIRATION EXCEPTION]', err);
    return res.status(500).json({ error: true, message: err.message });
  }
}
