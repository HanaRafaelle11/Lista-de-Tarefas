// Vercel Serverless Function: /api/billing/reactivate.js

import { supabaseAdmin } from '../../lib/supabase.js';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || "TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165";

export default async function handler(req, res) {
  // CORS configuration
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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

  const { userId, email } = req.body || {};

  if (!userId || !email) {
    res.status(400).json({ error: 'Os campos userId e email são obrigatórios.' });
    return;
  }

  try {
    // 1. Verificar se o usuário está qualificado para a reativação (status CANCELED ou PAST_DUE no Supabase)
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('plano, assinatura_status')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[API Reactivate] Erro ao consultar Supabase:', error.message);
      res.status(500).json({ error: 'Erro ao validar perfil do usuário.' });
      return;
    }

    const status = (profile?.assinatura_status || 'free').toUpperCase();
    const isEligible = ['CANCELED', 'PAST_DUE', 'FREE', 'CANCELLATION_PENDING'].includes(status);

    if (!isEligible) {
      console.warn(`[API Reactivate] Usuário ${userId} tentou reativar mas não está qualificado (Status: ${status})`);
      res.status(400).json({ error: 'Usuário não qualificado para oferta de reativação (assinatura ativa).' });
      return;
    }

    // 2. Determinar dinamicamente a URL base (localhost ou produção Vercel)
    const host = req.headers.host || 'localhost:5173';
    const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    const origin = `${protocol}://${host}`;

    // Oferece um desconto de retenção de 20% (R$ 11.90 em vez de R$ 14.90)
    const discountPrice = 11.90;

    console.log(`[API Reactivate] Gerando preferência de reativação com desconto para user ${userId} (${email}). Preço: R$ ${discountPrice}`);

    const payload = {
      items: [
        {
          id: "myflowday-pro-reactivate",
          title: "Reativação MyFlowDay Pro ⚡ (Desconto de Retenção)",
          description: "Retorno simplificado ao plano premium com 20% de desconto no primeiro mês.",
          quantity: 1,
          unit_price: discountPrice,
          currency_id: "BRL"
        }
      ],
      payer: {
        email: email
      },
      metadata: {
        user_id: userId,
        offer_type: 'reactivation_discount'
      },
      back_urls: {
        success: `${origin}/?payment=reactivated`,
        failure: `${origin}/?payment=failure`,
        pending: `${origin}/?payment=pending`
      },
      auto_return: "approved"
    };

    const mpResponse = await fetch('https://api.mercadopago.com/v1/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json().catch(() => ({}));
      console.error('[API Reactivate] Erro retornado pelo Mercado Pago:', errorData);
      res.status(500).json({ 
        error: 'Erro ao gerar link de reativação no Mercado Pago.', 
        details: errorData 
      });
      return;
    }

    const mpData = await mpResponse.json();
    console.log(`[API Reactivate] Preferência de reativação criada: ${mpData.id}`);

    res.status(200).json({ 
      preferenceId: mpData.id, 
      init_point: mpData.init_point 
    });
  } catch (error) {
    console.error('[API Reactivate] Erro inesperado:', error);
    res.status(500).json({ 
      error: 'Erro interno ao processar reativação.', 
      message: error.message 
    });
  }
}
