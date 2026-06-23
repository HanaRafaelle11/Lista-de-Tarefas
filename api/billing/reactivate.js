// Vercel Serverless Function: /api/billing/reactivate.js

import { supabaseAdmin } from '../../lib/supabase.js';

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

  const { userId, cpf } = req.body || {};

  if (!userId) {
    res.status(400).json({ error: 'O campo userId é obrigatório.' });
    return;
  }

  // Retrieve email from Auth
  let email = null;
  try {
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
    email = authData?.user?.email;
  } catch (err) {
    console.warn('[API Reactivate] Failed fetching email from Auth:', err.message);
  }

  if (!email || email.trim() === '' || email === 'test_user@test.com' || email.toLowerCase() === 'null' || email.toLowerCase() === 'undefined') {
    res.status(400).json({ error: 'Email inválido ou não informado.' });
    return;
  }

  try {
    // 1. Verificar se o usuário está qualificado para a reativação (status CANCELED ou PAST_DUE no Supabase)
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('plano, assinatura_status, name, nickname')
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

    // Obter dados de nome/nickname do perfil do usuário para consistência (Single Source of Truth)
    let first_name = '';
    let last_name = '';

    const fullName = profile?.name || profile?.nickname;
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      first_name = parts[0] || '';
      last_name = parts.slice(1).join(' ') || '';
    }

    // Validação estrita de nome - proibir campos genéricos e vazios
    if (!first_name || !last_name || isGenericName(first_name) || isGenericName(last_name)) {
      res.status(400).json({ error: 'Nome e sobrenome válidos são obrigatórios para prosseguir.' });
      return;
    }

    let identification = null;
    if (cpf) {
      const cleanCpf = cpf.replace(/\D/g, '');
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
        email: email.trim(),
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        entity_type: "individual",
        type: "customer",
        ...(identification ? { identification } : {})
      },
      external_reference: userId,
      statement_descriptor: "MYFLOWDAY",
      metadata: {
        user_id: userId,
        offer_type: 'reactivation_discount',
        cpf: cpf ? cpf.replace(/\D/g, '') : null,
        email: email.trim()
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
