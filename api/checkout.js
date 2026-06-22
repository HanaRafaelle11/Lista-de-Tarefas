// Vercel Serverless Function: /api/checkout.js

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

  if (req.method !== 'POST') {
    res.status(455 || 405).json({ error: 'Método não permitido. Utilize POST.' });
    return;
  }

  const { userId, email, notificationUrl } = req.body || {};

  if (!userId || !email) {
    res.status(400).json({ error: 'Os campos userId e email são obrigatórios no corpo da requisição.' });
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
        email: email
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
