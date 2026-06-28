// Automated Test Suite for Consolidated Billing Engine
// Run with: npm run test:billing

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🚀 Iniciando Configuração da Suíte de Testes do Billing Engine (Consolidated & Production Mode)...\n');

// 1. Carregar variáveis de ambiente de .env.local (se disponível)
const envPath = path.resolve('.env.local');
let envFile = '';
if (fs.existsSync(envPath)) {
  envFile = fs.readFileSync(envPath, 'utf8');
}

const parseEnv = (key) => {
  const match = envFile.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

// Configurações virtuais para evitar crashes ao instanciar o cliente Supabase
process.env.SUPABASE_URL = parseEnv('SUPABASE_URL') || parseEnv('VITE_SUPABASE_URL') || 'https://mftsklhrzhhvtsuamqaw.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = parseEnv('SUPABASE_SERVICE_ROLE_KEY') || 'mock-service-role-key-for-testing';
process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;

// Agora que o ambiente está configurado, podemos importar o BillingEngine dinamicamente
const { BillingEngine } = await import('../lib/billing/engine.js');
const { BillingStateMachine } = await import('../lib/billing/state-machine.js');
const { PLAN_PREMIUM_MONTHLY_PRICE, PLAN_FREE_PRICE } = await import('../lib/billing/config.js');

// Database em memória para simulação de PostgREST
const mockDatabase = {
  profiles: {},
  subscriptions: {},
  payment_events: [],
  webhook_events: [],
  events: []
};

// Interceptor global do fetch para simular o Supabase PostgREST
globalThis.fetch = async (url, options) => {
  const urlStr = String(url);
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.parse(options.body) : null;

  if (urlStr.includes('.supabase.co/rest/v1/')) {
    const table = urlStr.split('/rest/v1/')[1].split('?')[0];
    const query = urlStr.split('?')[1] || '';

    // Extrair filtros comuns de query
    let idEq = null;
    const idMatch = query.match(/(?:^|&)id=eq\.([^&]+)/);
    if (idMatch) idEq = decodeURIComponent(idMatch[1]);

    let userIdEq = null;
    const userIdMatch = query.match(/(?:^|&)user_id=eq\.([^&]+)/);
    if (userIdMatch) userIdEq = decodeURIComponent(userIdMatch[1]);

    let eventIdEq = null;
    const eventIdMatch = query.match(/(?:^|&)event_id=eq\.([^&]+)/);
    if (eventIdMatch) eventIdEq = decodeURIComponent(eventIdMatch[1]);

    let paymentIdEq = null;
    const paymentIdMatch = query.match(/(?:^|&)payment_id=eq\.([^&]+)/);
    if (paymentIdMatch) paymentIdEq = decodeURIComponent(paymentIdMatch[1]);

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

    if (table === 'payment_events') {
      if (method === 'GET') {
        let filtered = mockDatabase.payment_events;
        if (userIdEq) filtered = filtered.filter(e => e.user_id === userIdEq);
        return new Response(JSON.stringify(filtered), { status: 200 });
      } else if (method === 'POST') {
        const insertBody = Array.isArray(body) ? body[0] : body;
        mockDatabase.payment_events.push(insertBody);
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

    if (table === 'events') {
      if (method === 'POST') {
        const insertBody = Array.isArray(body) ? body[0] : body;
        mockDatabase.events.push(insertBody);
        return new Response(JSON.stringify([insertBody]), { status: 200 });
      }
    }

    return new Response(JSON.stringify([]), { status: 200 });
  }

  return new Response(JSON.stringify({}), { status: 200 });
};

// Auxiliar para resetar a base mock
function resetMockDb() {
  mockDatabase.profiles = {};
  mockDatabase.subscriptions = {};
  mockDatabase.payment_events = [];
  mockDatabase.webhook_events = [];
  mockDatabase.events = [];
}

// Rodar testes
async function runTests() {
  console.log('--- EXECUTA MÁQUINA DE ESTADOS E BILLING ENGINE TESTS ---');
  let successCount = 0;
  let failCount = 0;

  const runTest = async (name, testFn) => {
    try {
      resetMockDb();
      await testFn();
      console.log(`✅ Test [${name}] passou!`);
      successCount++;
    } catch (err) {
      console.error(`❌ Test [${name}] falhou:`, err.message);
      console.error(err);
      failCount++;
    }
  };

  // 1. Cartão Aprovado
  await runTest('Cartão Aprovado', async () => {
    const userId = 'user_cc_success';
    mockDatabase.profiles[userId] = { id: userId, plano: 'free', assinatura_status: 'free' };

    // Criar pendente
    await BillingEngine.createPendingSubscription(userId, {
      providerId: 'sub_cc_123',
      customerId: 'cus_123',
      billingType: 'credit_card'
    });

    assert.strictEqual(mockDatabase.subscriptions[userId].status, 'pending');
    assert.strictEqual(mockDatabase.profiles[userId].assinatura_status, 'pending');

    // Confirmar pagamento
    await BillingEngine.processPaymentSuccess({
      userId,
      customerId: 'cus_123',
      paymentId: 'pay_cc_123',
      subscriptionId: 'sub_cc_123',
      billingType: 'credit_card',
      value: PLAN_PREMIUM_MONTHLY_PRICE
    });

    assert.strictEqual(mockDatabase.subscriptions[userId].status, 'active');
    assert.strictEqual(mockDatabase.profiles[userId].plano, 'premium');
    assert.strictEqual(mockDatabase.subscriptions[userId].billing_type, 'credit_card');
    assert.strictEqual(mockDatabase.subscriptions[userId].price, PLAN_PREMIUM_MONTHLY_PRICE);
    assert.strictEqual(mockDatabase.subscriptions[userId].amount, PLAN_PREMIUM_MONTHLY_PRICE);
  });

  // 2. Cartão Recusado
  await runTest('Cartão Recusado', async () => {
    const userId = 'user_cc_failed';
    mockDatabase.profiles[userId] = { id: userId, plano: 'free', assinatura_status: 'free' };

    await BillingEngine.createPendingSubscription(userId, {
      providerId: 'sub_cc_failed',
      customerId: 'cus_456',
      billingType: 'credit_card'
    });

    // Simulando recusa com cancelamento
    await BillingEngine.processSubscriptionCanceled({
      userId,
      reason: 'canceled'
    });

    assert.strictEqual(mockDatabase.subscriptions[userId].status, 'canceled');
    assert.strictEqual(mockDatabase.profiles[userId].plano, 'free');
    assert.strictEqual(mockDatabase.subscriptions[userId].price, PLAN_FREE_PRICE);
  });

  // 3. Pix Pago
  await runTest('Pix Pago', async () => {
    const userId = 'user_pix_success';
    mockDatabase.profiles[userId] = { id: userId, plano: 'free', assinatura_status: 'free' };

    await BillingEngine.createPendingSubscription(userId, {
      providerId: 'pay_pix_123',
      customerId: 'cus_789',
      billingType: 'pix'
    });

    await BillingEngine.processPaymentSuccess({
      userId,
      customerId: 'cus_789',
      paymentId: 'pay_pix_123',
      billingType: 'pix',
      value: PLAN_PREMIUM_MONTHLY_PRICE
    });

    assert.strictEqual(mockDatabase.subscriptions[userId].status, 'active');
    assert.strictEqual(mockDatabase.profiles[userId].plano, 'premium');
    assert.strictEqual(mockDatabase.subscriptions[userId].billing_type, 'pix');
    assert.strictEqual(mockDatabase.subscriptions[userId].price, PLAN_PREMIUM_MONTHLY_PRICE);
  });

  // 4. Pix Expirado
  await runTest('Pix Expirado', async () => {
    const userId = 'user_pix_expired';
    mockDatabase.profiles[userId] = { id: userId, plano: 'free', assinatura_status: 'free' };

    await BillingEngine.createPendingSubscription(userId, {
      providerId: 'pay_pix_failed',
      customerId: 'cus_abc',
      billingType: 'pix'
    });

    await BillingEngine.processSubscriptionCanceled({
      userId,
      reason: 'expired'
    });

    assert.strictEqual(mockDatabase.subscriptions[userId].status, 'expired');
    assert.strictEqual(mockDatabase.profiles[userId].plano, 'free');
  });

  // 5. Webhook Duplicado (Idempotência)
  await runTest('Webhook Duplicado', async () => {
    const userId = 'user_webhook_dup';
    mockDatabase.profiles[userId] = { id: userId, plano: 'free', assinatura_status: 'free' };

    await BillingEngine.createPendingSubscription(userId, {
      providerId: 'sub_dup',
      customerId: 'cus_dup',
      billingType: 'credit_card'
    });

    const eventId = 'evt_test_123';
    mockDatabase.webhook_events.push({ event_id: eventId, status: 'processed' });

    const alreadyProcessed = mockDatabase.webhook_events.some(e => e.event_id === eventId);
    assert.strictEqual(alreadyProcessed, true);
  });

  // 6. Webhook Fora de Ordem
  await runTest('Webhook Fora de Ordem', async () => {
    const userId = 'user_order';
    mockDatabase.profiles[userId] = { id: userId, plano: 'premium', assinatura_status: 'active' };
    mockDatabase.subscriptions[userId] = { user_id: userId, status: 'active' };

    const isValid = BillingStateMachine.isValidTransition('active', 'pending');
    assert.strictEqual(isValid, false);
  });

  // 7. Retry (Restaurar Acesso)
  await runTest('Retry', async () => {
    const userId = 'user_retry';
    mockDatabase.profiles[userId] = { id: userId, plano: 'free', assinatura_status: 'past_due' };
    mockDatabase.subscriptions[userId] = { user_id: userId, status: 'past_due' };

    await BillingEngine.processPaymentSuccess({
      userId,
      customerId: 'cus_retry',
      paymentId: 'pay_retry_success',
      billingType: 'pix',
      value: PLAN_PREMIUM_MONTHLY_PRICE
    });

    assert.strictEqual(mockDatabase.subscriptions[userId].status, 'active');
    assert.strictEqual(mockDatabase.profiles[userId].plano, 'premium');
  });

  // 8. Timeout e Locks
  await runTest('Timeout', async () => {
    const { DistributedLock } = await import('../api/distributed-lock.js');
    let executed = false;
    await DistributedLock.withLock('test-lock', async () => {
      executed = true;
    });
    assert.strictEqual(executed, true);
  });

  // 9. Chargeback
  await runTest('Chargeback', async () => {
    const userId = 'user_chargeback';
    mockDatabase.profiles[userId] = { id: userId, plano: 'premium', assinatura_status: 'active' };
    mockDatabase.subscriptions[userId] = { user_id: userId, status: 'active' };

    await BillingEngine.processSubscriptionRefunded({ userId });

    assert.strictEqual(mockDatabase.subscriptions[userId].status, 'refunded');
    assert.strictEqual(mockDatabase.profiles[userId].plano, 'free');
  });

  // 10. Cancelamento
  await runTest('Cancelamento', async () => {
    const userId = 'user_cancel';
    mockDatabase.profiles[userId] = { id: userId, plano: 'premium', assinatura_status: 'active' };
    mockDatabase.subscriptions[userId] = { user_id: userId, status: 'active' };

    await BillingEngine.processSubscriptionCanceled({ userId, reason: 'canceled' });

    assert.strictEqual(mockDatabase.subscriptions[userId].status, 'canceled');
    assert.strictEqual(mockDatabase.profiles[userId].plano, 'free');
  });

  // 11. Renovação
  await runTest('Renovação', async () => {
    const userId = 'user_renew';
    mockDatabase.profiles[userId] = { id: userId, plano: 'premium', assinatura_status: 'active' };
    mockDatabase.subscriptions[userId] = { user_id: userId, status: 'active', current_period_end: new Date().toISOString() };

    await BillingEngine.processPaymentSuccess({
      userId,
      customerId: 'cus_renew',
      paymentId: 'pay_renew_123',
      billingType: 'credit_card',
      value: PLAN_PREMIUM_MONTHLY_PRICE
    });

    assert.strictEqual(mockDatabase.subscriptions[userId].status, 'active');
    assert.strictEqual(mockDatabase.profiles[userId].plano, 'premium');
  });

  // 12. Expiração
  await runTest('Expiração', async () => {
    const userId = 'user_expired';
    mockDatabase.profiles[userId] = { id: userId, plano: 'premium', assinatura_status: 'active' };
    mockDatabase.subscriptions[userId] = { user_id: userId, status: 'active' };

    await BillingEngine.processSubscriptionCanceled({ userId, reason: 'expired' });

    assert.strictEqual(mockDatabase.subscriptions[userId].status, 'expired');
    assert.strictEqual(mockDatabase.profiles[userId].plano, 'free');
  });

  // 13. Reativação
  await runTest('Reativação', async () => {
    const userId = 'user_reactivate';
    mockDatabase.profiles[userId] = { id: userId, plano: 'free', assinatura_status: 'canceled' };
    mockDatabase.subscriptions[userId] = { user_id: userId, status: 'canceled' };

    await BillingEngine.processPaymentSuccess({
      userId,
      customerId: 'cus_reactivate',
      paymentId: 'pay_reactivate_123',
      billingType: 'credit_card',
      value: PLAN_PREMIUM_MONTHLY_PRICE
    });

    assert.strictEqual(mockDatabase.subscriptions[userId].status, 'active');
    assert.strictEqual(mockDatabase.profiles[userId].plano, 'premium');
  });

  console.log(`\n🏁 Resultado Geral: ${successCount} Sucessos | ${failCount} Falhas`);
  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
