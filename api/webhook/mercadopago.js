// Vercel Serverless Function: /api/webhook/mercadopago.js

import { BillingEngine } from '../../services/billing-engine.js';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || "TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165";

export default async function handler(req, res) {
  // Configuração do CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Tratar requisição preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Mercado Pago envia POST para webhooks
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    return;
  }

  console.log('[Webhook Mercado Pago] Notificação recebida:', {
    query: req.query,
    body: req.body
  });

  // 1. Extrair ID do pagamento e Tópico dos diferentes formatos de payload do Mercado Pago
  let paymentId = null;
  let topic = null;

  // Formato Webhook padrão: { type: "payment", data: { id: "payment-id" } }
  if (req.body && req.body.type === 'payment') {
    paymentId = req.body.data && req.body.data.id;
    topic = 'payment';
  } 
  // Formato alternativo / antigo: { topic: "payment", id: "payment-id" }
  else if (req.body && req.body.topic === 'payment') {
    paymentId = req.body.id;
    topic = 'payment';
  }
  // Formato IPN (Query String): ?topic=payment&id=payment-id
  else if (req.query && req.query.topic === 'payment') {
    paymentId = req.query.id;
    topic = 'payment';
  }
  // Suporte a disparos diretos de testes (?data_id=payment-id)
  else if (req.query && req.query.data_id) {
    paymentId = req.query.data_id;
    topic = 'payment';
  }

  // Se não for um evento de pagamento, respondemos 200 OK para liberar a fila do MP
  if (topic !== 'payment' || !paymentId) {
    console.log('[Webhook Mercado Pago] Evento ignorado (não é de pagamento ou ID ausente). Tópico:', topic);
    res.status(200).json({ message: 'Evento recebido, mas não processado (tópico não suportado).' });
    return;
  }

  try {
    let paymentDetails;
    if (String(paymentId).startsWith('sim_') || String(paymentId).includes('mock')) {
      console.log(`[Webhook Mercado Pago] [MOCK] Simulating payment details for ID: ${paymentId}`);
      let status = 'approved';
      if (String(paymentId).includes('rejected')) status = 'rejected';
      else if (String(paymentId).includes('pending')) status = 'pending';
      else if (String(paymentId).includes('cancelled')) status = 'cancelled';
      
      const mockUserId = req.query.mock_user_id || (req.body && req.body.mock_user_id) || '0ba573ad-843c-4536-bfdb-e52bad2bed60';
      
      paymentDetails = {
        id: paymentId,
        status: status,
        transaction_amount: 14.90,
        date_approved: new Date().toISOString(),
        metadata: {
          user_id: mockUserId
        },
        payer: {
          id: 'mock_payer_123',
          email: 'test_user@test.com'
        }
      };
    } else {
      console.log(`[Webhook Mercado Pago] Buscando detalhes do pagamento ${paymentId} na API do Mercado Pago...`);

      // 2. Buscar detalhes reais do pagamento diretamente da API do Mercado Pago (Segurança contra Spoofing)
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!mpResponse.ok) {
        const errText = await mpResponse.text();
        console.error(`[Webhook Mercado Pago] Falha ao consultar pagamento ${paymentId} na API do MP:`, errText);
        // Retornamos 200 para evitar que o Mercado Pago fique tentando infinitamente em caso de IDs inválidos de teste
        res.status(200).json({ error: 'Erro ao consultar detalhes do pagamento no Mercado Pago.', details: errText });
        return;
      }

      paymentDetails = await mpResponse.json();
    }
    
    console.log(`[Webhook Mercado Pago] Detalhes do pagamento obtidos com sucesso. Status: ${paymentDetails.status}`);

    // 3. Extrair user_id enviado nos metadados durante a criação da preferência
    const userId = paymentDetails.metadata && paymentDetails.metadata.user_id;
    const payerCustomerId = paymentDetails.payer && paymentDetails.payer.id;

    if (!userId) {
      console.warn(`[Webhook Mercado Pago] Metadados 'user_id' não encontrados no pagamento ${paymentId}. Ignorando processamento.`);
      res.status(200).json({ message: 'Pagamento processado, mas sem user_id nos metadados.' });
      return;
    }

    // 4. Direcionar lógica no Billing Engine baseada no status do pagamento
    const paymentStatus = paymentDetails.status;
    let billingResult = null;

    if (paymentStatus === 'approved') {
      billingResult = await BillingEngine.handlePaymentApproved(userId, payerCustomerId, paymentId, paymentDetails);
      console.log('[Webhook Mercado Pago] Billing Engine aprovou premium com sucesso:', billingResult);
    } 
    else if (['cancelled', 'rejected', 'refunded', 'charged_back'].includes(paymentStatus)) {
      billingResult = await BillingEngine.handlePaymentCanceled(userId);
      console.log('[Webhook Mercado Pago] Billing Engine removeu premium (cancelado/reembolsado):', billingResult);
    } 
    else if (paymentStatus === 'past_due') {
      billingResult = await BillingEngine.handlePaymentPastDue(userId);
      console.log('[Webhook Mercado Pago] Billing Engine marcou assinatura como past_due:', billingResult);
    } 
    else {
      console.log(`[Webhook Mercado Pago] Pagamento ${paymentId} com status '${paymentStatus}' não alterou plano.`);
    }

    res.status(200).json({ 
      success: true, 
      paymentId, 
      status: paymentStatus, 
      userId,
      billingResult 
    });
  } catch (error) {
    console.error('[Webhook Mercado Pago] Erro interno ao processar webhook:', error);
    // Respondemos 500 para sinalizar falha no servidor para que o MP possa retentar
    res.status(500).json({ 
      error: 'Erro interno ao processar webhook.', 
      message: error.message 
    });
  }
}
