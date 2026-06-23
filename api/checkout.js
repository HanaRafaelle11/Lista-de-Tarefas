// Vercel Serverless Function: /api/checkout.js

import { supabaseAdmin } from '../lib/supabase.js';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!MERCADOPAGO_ACCESS_TOKEN) {
  throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
}

function validateCpf(cpf) {
  if (!cpf) return false;
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) return false;
  
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(10))) return false;
  
  return true;
}

function isGenericName(name) {
  if (!name) return true;
  const lower = name.toLowerCase().trim();
  return lower === 'usuario' || lower === 'flowday' || lower === 'usuario flowday' || lower === 'usuarioflowday' || lower === '' || lower === 'null' || lower === 'undefined';
}

export default async function handler(req, res) {
  // Configuração do CORS
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
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

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
    return;
  }

  const { userId, email: reqEmail, notificationUrl, payer } = req.body || {};

  if (!userId) {
    res.status(400).json({ error: 'O campo userId é obrigatório.' });
    return;
  }

  const email = reqEmail || payer?.email;
  if (!email || email.trim() === '' || email === 'test_user@test.com' || email.toLowerCase() === 'null' || email.toLowerCase() === 'undefined') {
    res.status(400).json({ error: 'Email inválido ou não informado.' });
    return;
  }

  try {
    // Determinar dinamicamente a URL base (localhost ou produção Vercel)
    const host = req.headers.host || 'localhost:5173';
    const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    let origin = `${protocol}://${host}`;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      origin = process.env.VITE_REDIRECT_URL || 'https://myflowday.com.br';
    }

    console.log(`[API Checkout] Criando preferência no Mercado Pago para user ${userId} (${email}). Origin: ${origin}`);

    const first_name = payer?.first_name;
    const last_name = payer?.last_name;

    // Validação estrita de nome - proibir campos genéricos e vazios
    if (!first_name || !last_name || isGenericName(first_name) || isGenericName(last_name)) {
      res.status(400).json({ error: 'Nome e sobrenome válidos são obrigatórios para prosseguir.' });
      return;
    }

    const cpfValue = payer?.identification?.number;
    let identification = null;
    if (cpfValue) {
      const cleanCpf = cpfValue.replace(/\D/g, '');
      if (cleanCpf) {
        if (cleanCpf.length !== 11 || !validateCpf(cleanCpf)) {
          res.status(400).json({ error: 'CPF inválido.' });
          return;
        }
        identification = {
          type: 'CPF',
          number: cleanCpf
        };
      }
    }

    const payload = {
      items: [
        {
          id: "myflowday-pro",
          title: "MyFlowDay Pro ⚡",
          description: "Acesso ilimitado ao coach, histórico avançado de 30+ dias e exportação de relatórios.",
          quantity: 1,
          unit_price: 14.90,
          currency_id: "BRL"
        }
      ],
      payer: {
        email: email.trim(),
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        entity_type: "individual",
        type: "customer",
        ...(identification ? { identification } : {})
      },
      metadata: {
        user_id: userId
      },
      back_urls: {
        success: `${origin}/?payment=success`,
        failure: `${origin}/?payment=failure`,
        pending: `${origin}/?payment=pending`
      },
      auto_return: "approved"
    };

    const finalWebhookUrl = notificationUrl || process.env.MERCADOPAGO_WEBHOOK_URL || (!origin.includes('localhost') && !origin.includes('127.0.0.1') ? `${origin}/api/webhook/mercadopago` : null);
    if (finalWebhookUrl) {
      payload.notification_url = finalWebhookUrl;
      console.log(`[API Checkout] Webhook notification URL configurada: ${finalWebhookUrl}`);
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json().catch(() => ({}));
      console.error('[API Checkout] Erro retornado pelo Mercado Pago:', errorData);
      res.status(500).json({ 
        error: 'Erro ao gerar link de checkout no Mercado Pago.', 
        details: errorData 
      });
      return;
    }

    const mpData = await mpResponse.json();
    console.log(`[API Checkout] Preferência gerada com sucesso: ${mpData.id}`);

    res.status(200).json({ 
      preferenceId: mpData.id, 
      init_point: mpData.init_point 
    });
  } catch (error) {
    console.error('[API Checkout] Erro inesperado:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao processar o checkout.', 
      message: error.message 
    });
  }
}

