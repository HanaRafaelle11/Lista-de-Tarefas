import { supabaseAdmin } from '../../lib/supabase.js';
import { BillingEngine } from '../../services/billing-engine.js';
import crypto from 'crypto';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || "TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165";

export default async function handler(req, res) {
  // CORS configuration
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
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

  const { token, payment_method_id, amount, userId } = req.body || {};

  if (!userId) {
    res.status(400).json({ error: 'userId é obrigatório.' });
    return;
  }

  if (!token || !payment_method_id) {
    res.status(400).json({ error: 'token e payment_method_id são obrigatórios.' });
    return;
  }

  try {
    const idempotencyKey = crypto.randomUUID();
    
    const payload = {
      transaction_amount: Number(amount) || 14.90,
      token,
      payment_method_id,
      payer: {
        email: "test_user@test.com"
      },
      description: "MyFlowDay Premium Plan"
    };

    console.log(`[API Payment] Iniciando pagamento com o Mercado Pago para o usuário ${userId}...`);

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    if (!mpResponse.ok) {
      const errData = await mpResponse.json().catch(() => ({}));
      console.error('[API Payment] Erro no Mercado Pago:', errData);
      res.status(400).json({ error: 'Falha no processamento do pagamento no Mercado Pago.', details: errData });
      return;
    }

    const paymentResult = await mpResponse.json();
    const paymentId = String(paymentResult.id);
    const paymentStatus = paymentResult.status;

    console.log(`[API Payment] Pagamento criado no MP. ID: ${paymentId}, Status: ${paymentStatus}`);

    if (paymentStatus === 'approved') {
      const customerId = paymentResult.payer?.id || `mp_cust_${crypto.randomUUID().slice(0, 8)}`;
      
      // 1. Chamar o BillingEngine (que atualiza perfis e registra eventos de cobrança/upgrade)
      await BillingEngine.handlePaymentApproved(userId, customerId, paymentId, {
        transaction_amount: payload.transaction_amount,
        date_approved: new Date().toISOString()
      });

      // 2. Atualizar a tabela de 'subscriptions' (Fonte de Verdade Analítica)
      const subData = {
        user_id: userId,
        status: 'active',
        plan: 'premium',
        price: payload.transaction_amount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: subErr } = await supabaseAdmin
        .from('subscriptions')
        .upsert(subData, { onConflict: 'user_id' });

      if (subErr) {
        console.error('[API Payment] Erro ao registrar assinatura na tabela subscriptions:', subErr.message);
      } else {
        console.log('[API Payment] Assinatura salva com sucesso em subscriptions.');
      }

      res.status(200).json({ success: true, paymentId, status: paymentStatus });
    } else {
      console.warn(`[API Payment] Pagamento não foi aprovado pelo MP. Status: ${paymentStatus}`);
      res.status(400).json({ error: `Pagamento não aprovado. Status: ${paymentStatus}`, paymentId, status: paymentStatus });
    }
  } catch (error) {
    console.error('[API Payment] Erro crítico no pagamento:', error);
    res.status(500).json({ error: 'Erro crítico interno ao processar pagamento.', message: error.message });
  }
}
