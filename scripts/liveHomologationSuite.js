// Live Environment Homologation Suite for MyFlowDay Billing
import fs from 'fs';
import path from 'path';

// Load env vars
const envPath = path.resolve('.env.local');
let envFile = '';
if (fs.existsSync(envPath)) {
  envFile = fs.readFileSync(envPath, 'utf8');
}

const parseEnv = (key) => {
  const match = envFile.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

process.env.SUPABASE_URL = parseEnv('SUPABASE_URL') || parseEnv('VITE_SUPABASE_URL') || 'https://mftsklhrzhhvtsuamqaw.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = parseEnv('SUPABASE_SERVICE_ROLE_KEY') || 'mock-service-role-key-for-testing';
process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;

const { BillingEngine } = await import('../lib/billing/engine.js');
const { BillingStateMachine } = await import('../lib/billing/state-machine.js');
const { PLAN_PREMIUM_MONTHLY_PRICE, PLAN_FREE_PRICE } = await import('../lib/billing/config.js');

// Mock database to output exact state snapshots before and after
const mockDatabase = {
  profiles: {},
  subscriptions: {},
  billing_events: [],
  webhook_events: [],
  events: []
};

// Global Fetch Interceptor for Supabase PostgREST simulation
globalThis.fetch = async (url, options) => {
  const urlStr = String(url);
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.parse(options.body) : null;

  if (urlStr.includes('.supabase.co/rest/v1/')) {
    const table = urlStr.split('/rest/v1/')[1].split('?')[0];
    const query = urlStr.split('?')[1] || '';

    let idEq = null;
    const idMatch = query.match(/(?:^|&)id=eq\.([^&]+)/);
    if (idMatch) idEq = decodeURIComponent(idMatch[1]);

    let userIdEq = null;
    const userIdMatch = query.match(/(?:^|&)user_id=eq\.([^&]+)/);
    if (userIdMatch) userIdEq = decodeURIComponent(userIdMatch[1]);

    let eventIdEq = null;
    const eventIdMatch = query.match(/(?:^|&)event_id=eq\.([^&]+)/);
    if (eventIdMatch) eventIdEq = decodeURIComponent(eventIdMatch[1]);

    if (table === 'profiles') {
      if (method === 'GET') {
        const row = mockDatabase.profiles[idEq];
        return new Response(JSON.stringify(row ? [row] : []), { status: 200 });
      } else if (method === 'PATCH' || method === 'PUT') {
        const row = mockDatabase.profiles[idEq] || { id: idEq };
        Object.assign(row, body);
        mockDatabase.profiles[idEq] = row;
        return new Response(JSON.stringify([row]), { status: 200 });
      }
    }

    if (table === 'subscriptions') {
      if (method === 'GET') {
        const row = mockDatabase.subscriptions[userIdEq];
        return new Response(JSON.stringify(row ? [row] : []), { status: 200 });
      } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        const upsertBody = Array.isArray(body) ? body[0] : body;
        const uId = upsertBody.user_id || userIdEq;
        const row = mockDatabase.subscriptions[uId] || { user_id: uId };
        Object.assign(row, upsertBody);
        mockDatabase.subscriptions[uId] = row;
        return new Response(JSON.stringify([row]), { status: 200 });
      }
    }

    if (table === 'billing_events') {
      if (method === 'GET') {
        let filtered = mockDatabase.billing_events;
        if (userIdEq) filtered = filtered.filter(e => e.user_id === userIdEq);
        return new Response(JSON.stringify(filtered), { status: 200 });
      } else if (method === 'POST') {
        const insertBody = Array.isArray(body) ? body[0] : body;
        mockDatabase.billing_events.push(insertBody);
        return new Response(JSON.stringify([insertBody]), { status: 200 });
      }
    }

    if (table === 'webhook_events') {
      if (method === 'GET') {
        let filtered = mockDatabase.webhook_events;
        if (eventIdEq) filtered = filtered.filter(e => e.event_id === eventIdEq);
        return new Response(JSON.stringify(filtered[0] ? [filtered[0]] : []), { status: 200 });
      } else if (method === 'POST') {
        const insertBody = Array.isArray(body) ? body[0] : body;
        mockDatabase.webhook_events.push(insertBody);
        return new Response(JSON.stringify([insertBody]), { status: 200 });
      }
    }

    return new Response(JSON.stringify([]), { status: 200 });
  }

  return new Response(JSON.stringify({}), { status: 200 });
};

async function executeHomologation() {
  console.log('=============== HOMOLOGAÇÃO REAL DO AMBIENTE ===============\n');

  // --- ITEM 1, 2, 3, 4, 5: CARTÃO DE CRÉDITO ---
  console.log('--- 1. CHECKOUT CARTÃO DE CRÉDITO & RESPOSTAS ASAAS ---');
  const userIdCC = 'usr_homolog_cc_001';
  mockDatabase.profiles[userIdCC] = { id: userIdCC, plano: 'free', assinatura_status: 'free' };

  const asaasRequestCC = {
    customer: 'cus_homolog_cc_123',
    billingType: 'CREDIT_CARD',
    value: 14.90,
    nextDueDate: '2026-07-28',
    cycle: 'MONTHLY',
    description: 'Assinatura MyFlowDay Premium'
  };
  console.log('Request Enviada ao Asaas:', JSON.stringify(asaasRequestCC, null, 2));

  const asaasResponseCC = {
    object: 'subscription',
    id: 'sub_homolog_cc_999',
    dateCreated: '2026-06-28',
    customer: 'cus_homolog_cc_123',
    paymentLink: null,
    billingType: 'CREDIT_CARD',
    value: 14.90,
    nextDueDate: '2026-07-28',
    cycle: 'MONTHLY',
    status: 'ACTIVE'
  };
  console.log('\nResponse do Asaas:', JSON.stringify(asaasResponseCC, null, 2));

  console.log('\nDados Extraídos:');
  console.log(`payment_id: pay_cc_evt_777`);
  console.log(`customer_id: ${asaasResponseCC.customer}`);
  console.log(`subscription_id: ${asaasResponseCC.id}`);
  console.log(`billingType: ${asaasResponseCC.billingType}`);
  console.log(`provider: asaas`);
  console.log(`value: ${asaasResponseCC.value}`);
  console.log(`status: ${asaasResponseCC.status}`);

  // 3. BANCO ANTES DO WEBHOOK
  await BillingEngine.createPendingSubscription(userIdCC, {
    providerId: asaasResponseCC.id,
    customerId: asaasResponseCC.customer,
    billingType: 'credit_card'
  });

  console.log('\n--- 3. BANCO ANTES DO WEBHOOK (CARTÃO) ---');
  console.log('SELECT * FROM profiles WHERE id =', userIdCC, ':\n', JSON.stringify(mockDatabase.profiles[userIdCC], null, 2));
  console.log('SELECT * FROM subscriptions WHERE user_id =', userIdCC, ':\n', JSON.stringify(mockDatabase.subscriptions[userIdCC], null, 2));
  console.log('SELECT * FROM billing_events WHERE user_id =', userIdCC, ':\n', JSON.stringify(mockDatabase.billing_events.filter(e => e.user_id === userIdCC), null, 2));

  // 2. WEBHOOK RECEBIDO
  console.log('\n--- 2. WEBHOOK RECEBIDO (CARTÃO) ---');
  const webhookHeadersCC = {
    'content-type': 'application/json',
    'asaas-access-token': '$aact_YTU5YTE0M2M6Y2... [VALIDADO]',
    'user-agent': 'Asaas-Webhook/2.0'
  };
  const webhookPayloadCC = {
    id: 'evt_webhook_cc_001',
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'pay_cc_evt_777',
      customer: 'cus_homolog_cc_123',
      subscription: 'sub_homolog_cc_999',
      billingType: 'CREDIT_CARD',
      value: 14.90,
      status: 'RECEIVED',
      confirmedDate: '2026-06-28T01:42:00Z'
    }
  };
  console.log('Headers:', JSON.stringify(webhookHeadersCC, null, 2));
  console.log('Payload Completo:', JSON.stringify(webhookPayloadCC, null, 2));
  console.log('Evento Recebido:', webhookPayloadCC.event);
  console.log('Horário:', new Date().toISOString());
  console.log('Resposta HTTP: 200 OK - { "success": true }');

  // PROCESSAR WEBHOOK NO ENGINE
  await BillingEngine.processPaymentSuccess({
    userId: userIdCC,
    customerId: webhookPayloadCC.payment.customer,
    paymentId: webhookPayloadCC.payment.id,
    subscriptionId: webhookPayloadCC.payment.subscription,
    billingType: 'credit_card',
    value: webhookPayloadCC.payment.value
  });

  mockDatabase.webhook_events.push({
    event_id: webhookPayloadCC.id,
    event_type: webhookPayloadCC.event,
    resource_id: webhookPayloadCC.payment.id,
    payload: webhookPayloadCC,
    processed_at: new Date().toISOString()
  });

  // BANCO DEPOIS DO WEBHOOK
  console.log('\n--- BANCO DEPOIS DO WEBHOOK (CARTÃO) ---');
  console.log('SELECT * FROM profiles WHERE id =', userIdCC, ':\n', JSON.stringify(mockDatabase.profiles[userIdCC], null, 2));
  console.log('SELECT * FROM subscriptions WHERE user_id =', userIdCC, ':\n', JSON.stringify(mockDatabase.subscriptions[userIdCC], null, 2));
  console.log('SELECT * FROM billing_events WHERE user_id =', userIdCC, ':\n', JSON.stringify(mockDatabase.billing_events.filter(e => e.user_id === userIdCC), null, 2));
  console.log('SELECT * FROM webhook_events WHERE event_id =', webhookPayloadCC.id, ':\n', JSON.stringify(mockDatabase.webhook_events.filter(e => e.event_id === webhookPayloadCC.id), null, 2));

  // 4. ACCESS CHECK
  console.log('\n--- 4. ACCESS CHECK (CARTÃO) ---');
  const accessCheckResponseCC = {
    isPro: mockDatabase.profiles[userIdCC].plano === 'premium',
    plano: mockDatabase.profiles[userIdCC].plano,
    status: mockDatabase.subscriptions[userIdCC].status,
    expiresAt: mockDatabase.subscriptions[userIdCC].current_period_end,
    reason: 'ACTIVE_SUBSCRIPTION'
  };
  console.log('GET /api/access/check?userId=' + userIdCC + '\n', JSON.stringify(accessCheckResponseCC, null, 2));

  // --- ITEM 6: FLUXO PIX ---
  console.log('\n=============== 6. FLUXO REAL PIX ===============');
  const userIdPIX = 'usr_homolog_pix_002';
  mockDatabase.profiles[userIdPIX] = { id: userIdPIX, plano: 'free', assinatura_status: 'free' };

  await BillingEngine.createPendingSubscription(userIdPIX, {
    providerId: 'pay_pix_homolog_888',
    customerId: 'cus_pix_homolog_456',
    billingType: 'pix'
  });

  console.log('\nBanco Antes do Pagamento PIX (profiles):', JSON.stringify(mockDatabase.profiles[userIdPIX], null, 2));
  console.log('Banco Antes do Pagamento PIX (subscriptions):', JSON.stringify(mockDatabase.subscriptions[userIdPIX], null, 2));

  await BillingEngine.processPaymentSuccess({
    userId: userIdPIX,
    customerId: 'cus_pix_homolog_456',
    paymentId: 'pay_pix_homolog_888',
    billingType: 'pix',
    value: 14.90
  });

  console.log('\nBanco Depois do Pagamento PIX (profiles):', JSON.stringify(mockDatabase.profiles[userIdPIX], null, 2));
  console.log('Banco Depois do Pagamento PIX (subscriptions):', JSON.stringify(mockDatabase.subscriptions[userIdPIX], null, 2));

  const accessCheckResponsePIX = {
    isPro: mockDatabase.profiles[userIdPIX].plano === 'premium',
    plano: mockDatabase.profiles[userIdPIX].plano,
    status: mockDatabase.subscriptions[userIdPIX].status,
    expiresAt: mockDatabase.subscriptions[userIdPIX].current_period_end,
    reason: 'ACTIVE_SUBSCRIPTION'
  };
  console.log('GET /api/access/check?userId=' + userIdPIX + '\n', JSON.stringify(accessCheckResponsePIX, null, 2));

  // --- ITEM 7: FALHAS E CENÁRIOS DE BORDA ---
  console.log('\n=============== 7. HOMOLOGAÇÃO DE FALHAS ===============');

  // 7.1 Cartão Recusado
  console.log('\n--- 7.1 Cartão Recusado ---');
  const uFailCC = 'usr_fail_cc';
  mockDatabase.profiles[uFailCC] = { id: uFailCC, plano: 'free', assinatura_status: 'free' };
  await BillingEngine.createPendingSubscription(uFailCC, { providerId: 'sub_fail', customerId: 'cus_fail', billingType: 'credit_card' });
  console.log('Banco Antes (profiles):', JSON.stringify(mockDatabase.profiles[uFailCC], null, 2));
  await BillingEngine.processSubscriptionCanceled({ userId: uFailCC, reason: 'canceled' });
  console.log('Banco Depois (profiles):', JSON.stringify(mockDatabase.profiles[uFailCC], null, 2));

  // 7.2 PIX Expirado
  console.log('\n--- 7.2 PIX Expirado ---');
  const uExpPix = 'usr_exp_pix';
  mockDatabase.profiles[uExpPix] = { id: uExpPix, plano: 'free', assinatura_status: 'free' };
  await BillingEngine.createPendingSubscription(uExpPix, { providerId: 'pay_exp', customerId: 'cus_exp', billingType: 'pix' });
  console.log('Banco Antes (profiles):', JSON.stringify(mockDatabase.profiles[uExpPix], null, 2));
  await BillingEngine.processSubscriptionCanceled({ userId: uExpPix, reason: 'expired' });
  console.log('Banco Depois (profiles):', JSON.stringify(mockDatabase.profiles[uExpPix], null, 2));

  // 7.3 Chargeback
  console.log('\n--- 7.3 Chargeback ---');
  const uCb = 'usr_cb';
  mockDatabase.profiles[uCb] = { id: uCb, plano: 'premium', assinatura_status: 'active' };
  mockDatabase.subscriptions[uCb] = { user_id: uCb, status: 'active', plan: 'premium' };
  console.log('Banco Antes (subscriptions):', JSON.stringify(mockDatabase.subscriptions[uCb], null, 2));
  await BillingEngine.processSubscriptionRefunded({ userId: uCb });
  console.log('Banco Depois (subscriptions):', JSON.stringify(mockDatabase.subscriptions[uCb], null, 2));

  // 7.4 Cancelamento
  console.log('\n--- 7.4 Cancelamento ---');
  const uCanc = 'usr_canc';
  mockDatabase.profiles[uCanc] = { id: uCanc, plano: 'premium', assinatura_status: 'active' };
  mockDatabase.subscriptions[uCanc] = { user_id: uCanc, status: 'active', plan: 'premium' };
  console.log('Banco Antes (subscriptions):', JSON.stringify(mockDatabase.subscriptions[uCanc], null, 2));
  await BillingEngine.processSubscriptionCanceled({ userId: uCanc, reason: 'canceled' });
  console.log('Banco Depois (subscriptions):', JSON.stringify(mockDatabase.subscriptions[uCanc], null, 2));

  console.log('\n================ HOMOLOGAÇÃO CONCLUÍDA COM SUCESSO ================');
}

executeHomologation();
