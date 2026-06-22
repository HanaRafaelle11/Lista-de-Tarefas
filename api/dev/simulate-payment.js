import { supabaseAdmin } from '../../lib/supabase.js';
import { BillingEngine } from '../../services/billing-engine.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const { userId } = req.body || {};

  if (!userId) {
    res.status(400).json({ error: 'userId é obrigatório.' });
    return;
  }

  try {
    const paymentId = `sim_pay_${crypto.randomBytes(8).toString('hex')}`;
    const customerId = `mp_cust_sim_${crypto.randomBytes(4).toString('hex')}`;
    const amount = 14.90;

    console.log(`[API Dev Simulate] Simulando pagamento aprovado para user ${userId}...`);

    // 1. Chamar o BillingEngine diretamente
    await BillingEngine.handlePaymentApproved(userId, customerId, paymentId, {
      transaction_amount: amount,
      date_approved: new Date().toISOString()
    });

    // 2. Atualizar a tabela de subscriptions diretamente
    const subData = {
      user_id: userId,
      status: 'active',
      plan: 'premium',
      price: amount,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .upsert(subData, { onConflict: 'user_id' });

    if (subErr) {
      console.error('[API Dev Simulate] Erro ao salvar em subscriptions:', subErr.message);
    } else {
      console.log('[API Dev Simulate] Assinatura ativa registrada com sucesso em subscriptions.');
    }

    res.status(200).json({
      success: true,
      message: 'Pagamento simulado e aprovado com sucesso!',
      paymentId,
      status: 'approved'
    });
  } catch (error) {
    console.error('[API Dev Simulate] Erro na simulação de pagamento:', error);
    res.status(500).json({ error: 'Erro ao processar simulação de pagamento.', message: error.message });
  }
}
