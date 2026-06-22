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

  const { token, payment_method_id, amount, userId, payer } = req.body || {};

  if (!userId) {
    res.status(400).json({ error: 'userId é obrigatório.' });
    return;
  }

  if (!payment_method_id) {
    res.status(400).json({ error: 'payment_method_id é obrigatório.' });
    return;
  }

  // Token is required only if it is NOT Pix
  if (payment_method_id !== 'pix' && !token) {
    res.status(400).json({ error: 'token é obrigatório para pagamentos com cartão.' });
    return;
  }

  try {
    const idempotencyKey = crypto.randomUUID();
    
    const payload = {
      transaction_amount: Number(amount) || 14.90,
      payment_method_id,
      payer: {
        email: payer?.email || "test_user@test.com"
      },
      description: "MyFlowDay Premium Plan"
    };

    if (payment_method_id !== 'pix') {
      payload.token = token;
    } else {
      // Forward additional payer information needed for Pix in Brazil
      if (payer?.identification) {
        payload.payer.identification = payer.identification;
      }
      if (payer?.first_name) {
        payload.payer.first_name = payer.first_name;
      }
      if (payer?.last_name) {
        payload.payer.last_name = payer.last_name;
      }
    }

    console.log(`[API Payment] Iniciando pagamento com o Mercado Pago (${payment_method_id}) para o usuário ${userId}...`);

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
      console.error('[API Payment] Erro completo do Mercado Pago:', JSON.stringify(errData, null, 2));
      if (errData.cause) {
        console.error('[API Payment] Causa do Erro:', JSON.stringify(errData.cause, null, 2));
      }
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
    } else if (paymentStatus === 'pending' && payment_method_id === 'pix') {
      const qrCode = paymentResult.point_of_interaction?.transaction_data?.qr_code;
      const qrCodeBase64 = paymentResult.point_of_interaction?.transaction_data?.qr_code_base64;
      
      res.status(200).json({ 
        success: true, 
        paymentId, 
        status: 'pending', 
        paymentMethod: 'pix',
        qr_code: qrCode, 
        qr_code_base64: qrCodeBase64 
      });
    } else {
      console.warn(`[API Payment] Pagamento não foi aprovado pelo MP. Status: ${paymentStatus}`);
      res.status(400).json({ error: `Pagamento não aprovado. Status: ${paymentStatus}`, paymentId, status: paymentStatus });
    }
  } catch (error) {
    console.error('[API Payment] Erro crítico no pagamento:', error);
    res.status(500).json({ error: 'Erro crítico interno ao processar pagamento.', message: error.message });
  }
}
