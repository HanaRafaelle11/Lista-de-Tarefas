// Automated Test Suite for MyFlowDay Billing Engine
// Run with: npm run test:billing

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🚀 Iniciando Configuração da Suíte de Testes do Billing Engine (Consistent & Production Mode)...\n');

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

// Configurações virtuais para evitar crashes
const supabaseUrl = parseEnv('SUPABASE_URL') || parseEnv('VITE_SUPABASE_URL') || 'https://mftsklhrzhhvtsuamqaw.supabase.co';
const supabaseServiceKey = parseEnv('SUPABASE_SERVICE_ROLE_KEY') || 'mock-service-role-key-for-testing';

process.env.SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_SERVICE_ROLE_KEY = supabaseServiceKey;
process.env.VITE_SUPABASE_URL = supabaseUrl;
process.env.VITE_SUPABASE_ANON_KEY = parseEnv('VITE_SUPABASE_ANON_KEY') || 'mock-anon-key';
process.env.MERCADOPAGO_ACCESS_TOKEN = parseEnv('MERCADOPAGO_ACCESS_TOKEN') || 'TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165';
process.env.CRON_SECRET = parseEnv('CRON_SECRET') || 'flowday-cron-secret-1234';

// 2. Banco de dados em memória para simulação de queries PostgREST
const mockDatabase = {
  profiles: {},
  billing_events: [],
  events: []
};

// 3. Mockar chamadas de fetch externas (tanto para Mercado Pago quanto para o Supabase)
let mockFetchPayments = {};
let mockFetchPreapprovals = [];
let mockFetchPreferences = [];

const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, options) => {
  const urlStr = String(url);

  // --- INTERCEPTOR SUPABASE (POSTGREST MOCK) ---
  if (urlStr.includes('.supabase.co/rest/v1/') || urlStr.includes('supabase.co/rest/v1/')) {
    const path = urlStr.split('/rest/v1/')[1].split('?')[0];
    const query = urlStr.split('?')[1] || '';
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.parse(options.body) : null;

    // Extrair filtros comuns de query
    let idEq = null;
    if (query.includes('id=eq.')) {
      idEq = decodeURIComponent(query.split('id=eq.')[1].split('&')[0]);
    }
    let paymentIdEq = null;
    if (query.includes('payment_id=eq.')) {
      paymentIdEq = decodeURIComponent(query.split('payment_id=eq.')[1].split('&')[0]);
    }
    let userIdEq = null;
    if (query.includes('user_id=eq.')) {
      userIdEq = decodeURIComponent(query.split('user_id=eq.')[1].split('&')[0]);
    }

    let responseData = [];
    let responseStatus = 200;

    if (path === 'profiles') {
      if (method === 'GET') {
        const profile = mockDatabase.profiles[idEq];
        responseData = profile ? [profile] : [];
      } else if (method === 'PATCH') {
        const profile = mockDatabase.profiles[idEq];
        if (profile) {
          Object.assign(profile, body);
          responseData = [profile];
        } else {
          responseData = [];
        }
      } else if (method === 'POST') {
        const records = Array.isArray(body) ? body : [body];
        records.forEach(r => {
          mockDatabase.profiles[r.id] = { ...r };
        });
        responseData = records;
        responseStatus = 201;
      } else if (method === 'DELETE') {
        if (idEq) {
          delete mockDatabase.profiles[idEq];
        }
        responseData = [];
      }
    } else if (path === 'billing_events') {
      if (method === 'GET') {
        let results = mockDatabase.billing_events;
        if (paymentIdEq) {
          results = results.filter(e => {
            const pId = e.payment_id || (e.metadata && e.metadata.payment_id);
            return pId === paymentIdEq;
          });
        }
        if (userIdEq) {
          results = results.filter(e => e.user_id === userIdEq);
        }
        responseData = results;
      } else if (method === 'POST') {
        const records = Array.isArray(body) ? body : [body];
        // Validar unique key constraint
        for (const r of records) {
          const r_payment_id = r.payment_id || (r.metadata && r.metadata.payment_id);
          if (r_payment_id) {
            const duplicate = mockDatabase.billing_events.find(e => {
              const e_payment_id = e.payment_id || (e.metadata && e.metadata.payment_id);
              return e_payment_id === r_payment_id;
            });
            if (duplicate) {
              return {
                ok: false,
                status: 409,
                statusText: 'Conflict',
                headers: new Headers({ 'content-type': 'application/json' }),
                json: async () => ({ code: '23505', message: 'duplicate key value violates unique constraint' }),
                text: async () => JSON.stringify({ code: '23505', message: 'duplicate key' })
              };
            }
          }
        }
        records.forEach(r => {
          const payment_id = r.payment_id || (r.metadata && r.metadata.payment_id);
          mockDatabase.billing_events.push({ 
            id: r.id || 'be_mock_' + Math.random().toString(36).substr(2, 9),
            created_at: r.created_at || new Date().toISOString(),
            payment_id,
            ...r 
          });
        });
        responseData = records;
        responseStatus = 201;
      } else if (method === 'DELETE') {
        if (userIdEq) {
          mockDatabase.billing_events = mockDatabase.billing_events.filter(e => e.user_id !== userIdEq);
        }
        responseData = [];
      }
    } else if (path === 'events') {
      if (method === 'GET') {
        let results = mockDatabase.events;
        if (userIdEq) {
          results = results.filter(e => e.user_id === userIdEq);
        }
        responseData = results;
      } else if (method === 'POST') {
        const records = Array.isArray(body) ? body : [body];
        records.forEach(r => {
          mockDatabase.events.push({ 
            id: r.id || 'event_mock_' + Math.random().toString(36).substr(2, 9),
            created_at: r.created_at || new Date().toISOString(),
            ...r 
          });
        });
        responseData = records;
        responseStatus = 201;
      } else if (method === 'DELETE') {
        if (userIdEq) {
          mockDatabase.events = mockDatabase.events.filter(e => e.user_id !== userIdEq);
        }
        responseData = [];
      }
    }

    return {
      ok: responseStatus >= 200 && responseStatus < 300,
      status: responseStatus,
      statusText: responseStatus === 201 ? 'Created' : 'OK',
      headers: new Headers({
        'content-type': 'application/json',
        'content-range': `0-${responseData.length}/${responseData.length}`
      }),
      json: async () => responseData,
      text: async () => JSON.stringify(responseData)
    };
  }

  // --- INTERCEPTOR MERCADO PAGO ---
  // Prefs de Checkout
  if (urlStr.includes('api.mercadopago.com/v1/checkout/preferences') || urlStr.includes('api.mercadopago.com/checkout/preferences')) {
    const body = JSON.parse(options?.body || '{}');
    mockFetchPreferences.push({ url, options, body });
    return {
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        id: 'pref_mock_' + Math.random().toString(36).substr(2, 9),
        init_point: 'https://www.mercadopago.com.br/sandbox/pay/mock'
      })
    };
  }

  // Busca individual de pagamentos (não deve interceptar o search)
  if (urlStr.includes('api.mercadopago.com/v1/payments/') && !urlStr.includes('/payments/search')) {
    const paymentId = urlStr.split('/').pop().split('?')[0];
    const mockPayment = mockFetchPayments[paymentId];
    if (mockPayment) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockPayment
      };
    }
    return {
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ error: 'not_found', message: `Payment ${paymentId} not found in mock` }),
      json: async () => ({ error: 'not_found', message: `Payment ${paymentId} not found in mock` })
    };
  }

  // Busca geral de pagamentos (Reconciliação)
  if (urlStr.includes('api.mercadopago.com/v1/payments/search')) {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        results: Object.values(mockFetchPayments)
      })
    };
  }

  // Busca de assinaturas recorrentes (Reconciliação)
  if (urlStr.includes('api.mercadopago.com/preapproval/search')) {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        results: mockFetchPreapprovals
      })
    };
  }

  // Fallback
  return originalFetch(url, options);
};

// 4. Importar os handlers de API dinamicamente
const checkoutHandler = (await import('../api/checkout.js')).default;
const webhookHandler = (await import('../api/webhook/mercadopago.js')).default;
const reactivateHandler = (await import('../api/billing/reactivate.js')).default;
const reconcileHandler = (await import('../api/billing/reconcile.js')).default;
const legacyCheckAccessHandler = (await import('../api/auth/check-access.js')).default;
const checkAccessHandler = (await import('../api/access/check.js')).default;
const revenueHandler = (await import('../api/analytics/revenue.js')).default;
const userTimelineHandler = (await import('../api/analytics/user-timeline.js')).default;

// UUID exclusivo para testes
const testUserId = '00000000-0000-0000-0000-000000000009';
const testUserEmail = 'billing_test_suite@flowday.app';

// Helper de simulação para Vercel Req e Res
function mockReqRes(options = {}) {
  const req = {
    method: options.method || 'GET',
    headers: options.headers || {},
    query: options.query || {},
    body: options.body || {},
    ...options
  };

  let resolved = null;
  const promise = new Promise((resolve) => {
    resolved = resolve;
  });

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      resolved(this);
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    end() {
      resolved(this);
      return this;
    }
  };

  return { req, res, promise };
}

// Setup do banco de dados em memória
function setupTestUser() {
  console.log(`➕ [Setup] Configurando dados do usuário de teste ${testUserId} na base virtual...`);
  mockDatabase.profiles = {};
  mockDatabase.billing_events = [];
  mockDatabase.events = [];

  mockDatabase.profiles[testUserId] = {
    id: testUserId,
    name: 'Test Runner Billing',
    plano: 'free',
    assinatura_status: 'free',
    assinatura_inicio: null,
    assinatura_expira_em: null,
    mercadopago_customer_id: null
  };
  console.log('✅ Dados configurados.');
}

// Execução da Suite de Testes
async function runTests() {
  let passed = 0;
  let failed = 0;

  const runTest = async (name, fn) => {
    console.log(`\n========================================`);
    console.log(`🧪 Teste: ${name}`);
    console.log(`========================================`);
    try {
      await fn();
      console.log(`🟢 PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`🔴 FAILED: ${name}`);
      console.error(err);
      failed++;
    }
  };

  try {
    setupTestUser();

    // --- TESTE 1: Criação de Checkout padrão ---
    await runTest('Checkout Creation', async () => {
      mockFetchPreferences = [];
      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: { userId: testUserId, email: testUserEmail }
      });

      checkoutHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200, 'Status deve ser 200');
      assert.ok(result.body.preferenceId, 'Deve retornar um preferenceId');
      assert.ok(result.body.init_point, 'Deve retornar um init_point');
      assert.strictEqual(mockFetchPreferences.length, 1, 'Deve ter chamado a API do Mercado Pago');
      assert.strictEqual(mockFetchPreferences[0].body.items[0].unit_price, 14.90, 'Preço padrão deve ser 14.90');
    });

    // --- TESTE 2: Criação de Checkout de Reativação com Desconto ---
    await runTest('Reactivation Checkout Creation (20% OFF)', async () => {
      // Configurar status do perfil como cancelado para estar elegível
      mockDatabase.profiles[testUserId].assinatura_status = 'canceled';

      mockFetchPreferences = [];
      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: { userId: testUserId, email: testUserEmail }
      });

      reactivateHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200, 'Status deve ser 200');
      assert.ok(result.body.preferenceId, 'Deve retornar um preferenceId');
      assert.strictEqual(mockFetchPreferences.length, 1, 'Deve ter chamado a API do Mercado Pago');
      assert.strictEqual(mockFetchPreferences[0].body.items[0].unit_price, 11.90, 'Preço de reativação deve ser 11.90 (20% desconto)');
      assert.strictEqual(mockFetchPreferences[0].body.metadata.offer_type, 'reactivation_discount', 'Deve carregar metadado da oferta');
    });

    // --- TESTE 3: Webhook de Pagamento Aprovado ---
    await runTest('Webhook Mercado Pago (Payment Approved & Event-driven logs)', async () => {
      // Reiniciar status para free
      mockDatabase.profiles[testUserId].plano = 'free';
      mockDatabase.profiles[testUserId].assinatura_status = 'free';
      mockDatabase.profiles[testUserId].assinatura_expira_em = null;
      mockDatabase.events = [];
      mockDatabase.billing_events = [];

      const paymentId = 'pay_approved_test_' + Date.now();
      mockFetchPayments[paymentId] = {
        id: paymentId,
        status: 'approved',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_test_123' },
        date_approved: new Date().toISOString()
      };

      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });

      webhookHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200, 'Webhook deve responder 200 OK');

      // Validar banco de dados virtual
      const profile = mockDatabase.profiles[testUserId];
      assert.strictEqual(profile.plano, 'premium', 'Plano deve ser atualizado para premium');
      assert.strictEqual(profile.assinatura_status, 'active', 'Status da assinatura deve ser active');

      // Validar faturamento orientado a eventos: billing_events gerados
      const paymentBillingEvent = mockDatabase.billing_events.find(e => e.payment_id === paymentId);
      assert.ok(paymentBillingEvent, 'Deve cadastrar evento de pagamento em billing_events');
      assert.strictEqual(paymentBillingEvent.status, 'approved');

      // Evento sintético gerado por setUserPremium em billing_events
      const syntheticBillingEvent = mockDatabase.billing_events.find(e => e.payment_id.startsWith('upg_'));
      assert.ok(syntheticBillingEvent, 'Toda alteração deve gerar billing_events (inclusive synthetic upg_)');

      // Validar logs de faturamento obrigatórios em events
      const receivedLog = mockDatabase.events.find(e => e.event_type === 'payment_received');
      assert.ok(receivedLog, 'Deve registrar log payment_received');

      const approvedLog = mockDatabase.events.find(e => e.event_type === 'payment_approved');
      assert.ok(approvedLog, 'Deve registrar log payment_approved');

      const upgradedLog = mockDatabase.events.find(e => e.event_type === 'user_upgraded');
      assert.ok(upgradedLog, 'Deve registrar log user_upgraded');
    });

    // --- TESTE 4: Idempotência do Webhook ---
    await runTest('Webhook Idempotency (payment_ignored_duplicate log)', async () => {
      const paymentId = Object.keys(mockFetchPayments).find(k => k.startsWith('pay_approved_test_'));
      
      mockDatabase.events = [];

      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });

      webhookHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200, 'Deve retornar 200 OK');
      assert.strictEqual(result.body.billingResult.duplicated, true, 'billingResult deve acusar duplicação');

      // Verificar logs obrigatórios
      const ignoredLog = mockDatabase.events.find(e => e.event_type === 'payment_ignored_duplicate');
      assert.ok(ignoredLog, 'Deve registrar log payment_ignored_duplicate');
    });

    // --- TESTE 5: Webhook de Pagamento Cancelado / Devolvido ---
    await runTest('Webhook Mercado Pago (Payment Canceled/Refunded & payment_failed log)', async () => {
      mockDatabase.events = [];
      mockDatabase.billing_events = [];

      const paymentId = 'pay_refunded_test_' + Date.now();
      mockFetchPayments[paymentId] = {
        id: paymentId,
        status: 'refunded',
        metadata: { user_id: testUserId }
      };

      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });

      webhookHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200, 'Webhook deve responder 200 OK');

      // Validar banco de dados virtual (downgrade para EXPIRED)
      const profile = mockDatabase.profiles[testUserId];
      assert.strictEqual(profile.plano, 'free', 'Plano deve sofrer downgrade para free');
      assert.strictEqual(profile.assinatura_status, 'canceled', 'Status da assinatura deve ser canceled');

      // Verificar logs analíticos
      const failedLog = mockDatabase.events.find(e => e.event_type === 'payment_failed');
      assert.ok(failedLog, 'Deve registrar log payment_failed');

      const downgradedLog = mockDatabase.events.find(e => e.event_type === 'user_downgraded');
      assert.ok(downgradedLog, 'Deve registrar log user_downgraded');

      // Verificar billing_events sintético para downgrade
      const downBillingEvent = mockDatabase.billing_events.find(e => e.payment_id.startsWith('down_'));
      assert.ok(downBillingEvent, 'Downgrade deve gerar billing_events sintético (down_)');
    });

    // --- TESTE 6: Anti-Drift System (Reconciliador) ---
    await runTest('Anti-Drift System (Reconciliation and Consistency violation logs)', async () => {
      // 1. Simular falha de Webhook: Usuário está 'free'/'free' no banco virtual, mas tem pagamento 'approved' no MP
      console.log('   -> Cenário A: Recuperando webhook perdido (Free no banco, Approved no MP)');
      mockDatabase.profiles[testUserId].plano = 'free';
      mockDatabase.profiles[testUserId].assinatura_status = 'free';
      mockDatabase.billing_events = [];
      mockDatabase.events = [];

      const paymentId = 'pay_reconcile_test_' + Date.now();
      mockFetchPayments = {}; // Limpar cache
      mockFetchPayments[paymentId] = {
        id: paymentId,
        status: 'approved',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_reconcile_123' },
        date_approved: new Date().toISOString()
      };

      const { req, res, promise } = mockReqRes({
        method: 'GET',
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
      });

      reconcileHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body.discrepanciesFixed, 1, 'Deve detectar e corrigir 1 inconsistência de pagamento');

      // Verificar correção no banco virtual
      const profileFixed = mockDatabase.profiles[testUserId];
      assert.strictEqual(profileFixed.plano, 'premium', 'Reconciliador deve ativar premium');
      assert.strictEqual(profileFixed.assinatura_status, 'active', 'Reconciliador deve ativar status active');

      // Validar logs do Anti-drift
      const runLog = mockDatabase.events.find(e => e.event_type === 'consistency_check_run');
      assert.ok(runLog, 'Deve registrar log consistency_check_run');

      const violationLog = mockDatabase.events.find(e => e.event_type === 'consistency_violation_detected');
      assert.ok(violationLog, 'Deve registrar log consistency_violation_detected (drift_detected)');

      const fixLog = mockDatabase.events.find(e => e.event_type === 'reconciliation_fix_applied');
      assert.ok(fixLog, 'Deve registrar log reconciliation_fix_applied (drift_resolved)');

      // 2. Simular cancelamento em background: Usuário está ativo no banco virtual, mas assinatura MP está cancelada
      console.log('   -> Cenário B: Cancelando acesso expirado (Premium no banco, Canceled no MP)');
      mockDatabase.profiles[testUserId].plano = 'premium';
      mockDatabase.profiles[testUserId].assinatura_status = 'active';
      mockDatabase.events = [];

      mockFetchPreapprovals = [{
        id: 'sub_reconcile_mock_1',
        status: 'cancelled',
        external_reference: testUserId,
        payer_id: 'cust_reconcile_123'
      }];
      mockFetchPayments = {}; // Remove pagamentos aprovados

      const { req: reqSub, res: resSub, promise: promiseSub } = mockReqRes({
        method: 'GET',
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
      });

      reconcileHandler(reqSub, resSub);
      const resultSub = await promiseSub;

      assert.strictEqual(resultSub.statusCode, 200);
      assert.strictEqual(resultSub.body.discrepanciesFixed, 1, 'Deve detectar e corrigir 1 inconsistência de assinatura recorrente');

      // Verificar downgrade
      const profileDowngraded = mockDatabase.profiles[testUserId];
      assert.strictEqual(profileDowngraded.plano, 'free', 'Reconciliador deve remover plano premium');
      assert.strictEqual(profileDowngraded.assinatura_status, 'canceled', 'Reconciliador deve alterar status para canceled');

      const violationLogSub = mockDatabase.events.find(e => e.event_type === 'consistency_violation_detected');
      assert.ok(violationLogSub, 'Deve registrar log consistency_violation_detected (Cenário B)');
    });

    // --- TESTE 7: Autoridade Server-side (Check-Access & Zero Trust endpoints) ---
    await runTest('Server-side Access Authority (Zero Trust /api/access/check & legacy)', async () => {
      // Caso A: Usuário Premium Ativo
      console.log('   -> Cenário A: Usuário Ativo (Premium / ACTIVE)');
      mockDatabase.profiles[testUserId].plano = 'premium';
      mockDatabase.profiles[testUserId].assinatura_status = 'active';
      mockDatabase.profiles[testUserId].assinatura_expira_em = null;
      mockDatabase.events = [];

      // Validar novo endpoint
      const { req: reqA, res: resA, promise: promiseA } = mockReqRes({
        method: 'GET',
        query: { userId: testUserId }
      });
      checkAccessHandler(reqA, resA);
      const resValA = await promiseA;
      assert.strictEqual(resValA.body.isPro, true, 'check-access novo deve conceder acesso');
      assert.strictEqual(resValA.body.status, 'ACTIVE');

      // Validar endpoint legado (deve retornar o mesmo resultado)
      const { req: reqLegacyA, res: resLegacyA, promise: promiseLegacyA } = mockReqRes({
        method: 'GET',
        query: { userId: testUserId }
      });
      legacyCheckAccessHandler(reqLegacyA, resLegacyA);
      const resLegacyValA = await promiseLegacyA;
      assert.strictEqual(resLegacyValA.body.isPro, true, 'check-access legado deve conceder acesso');
      assert.strictEqual(resLegacyValA.body.status, 'ACTIVE');

      // Validar logs de auditoria de observabilidade
      const evalLogA = mockDatabase.events.find(e => e.event_type === 'access_decision_evaluated');
      assert.ok(evalLogA, 'Deve registrar log access_decision_evaluated');

      const grantLogA = mockDatabase.events.find(e => e.event_type === 'access_granted');
      assert.ok(grantLogA, 'Deve registrar log access_granted');

      // Caso B: Usuário Free
      console.log('   -> Cenário B: Usuário Free (Free / free)');
      mockDatabase.profiles[testUserId].plano = 'free';
      mockDatabase.profiles[testUserId].assinatura_status = 'free';
      mockDatabase.profiles[testUserId].assinatura_expira_em = null;
      mockDatabase.events = [];

      const { req: reqB, res: resB, promise: promiseB } = mockReqRes({
        method: 'GET',
        query: { userId: testUserId }
      });
      checkAccessHandler(reqB, resB);
      const resValB = await promiseB;
      assert.strictEqual(resValB.body.isPro, false, 'check-access novo deve negar acesso para Free');

      const denyLogB = mockDatabase.events.find(e => e.event_type === 'access_denied_reason');
      assert.ok(denyLogB, 'Deve registrar log access_denied_reason');
      assert.strictEqual(denyLogB.metadata.reason, 'FREE', 'Razão deve ser FREE');

      // Caso C: Grace Period Ativo (CANCELED, expira_em no futuro)
      console.log('   -> Cenário C: Período de Carência Ativo (CANCELED + Expiração Futura)');
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      mockDatabase.profiles[testUserId].plano = 'premium';
      mockDatabase.profiles[testUserId].assinatura_status = 'canceled';
      mockDatabase.profiles[testUserId].assinatura_expira_em = futureDate.toISOString();

      const { req: reqC, res: resC, promise: promiseC } = mockReqRes({
        method: 'GET',
        query: { userId: testUserId }
      });
      checkAccessHandler(reqC, resC);
      const resValC = await promiseC;
      assert.strictEqual(resValC.body.isPro, true, 'check-access novo deve conceder acesso em Grace Period');
      assert.strictEqual(resValC.body.status, 'CANCELED');

      // Caso D: Grace Period Expirado (CANCELED, expira_em no passado)
      console.log('   -> Cenário D: Período de Carência Expirado (CANCELED + Expiração Passada)');
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      mockDatabase.profiles[testUserId].plano = 'premium';
      mockDatabase.profiles[testUserId].assinatura_status = 'canceled';
      mockDatabase.profiles[testUserId].assinatura_expira_em = pastDate.toISOString();
      mockDatabase.events = [];

      const { req: reqD, res: resD, promise: promiseD } = mockReqRes({
        method: 'GET',
        query: { userId: testUserId }
      });
      checkAccessHandler(reqD, resD);
      const resValD = await promiseD;
      assert.strictEqual(resValD.body.isPro, false, 'check-access novo deve negar acesso após Grace Period expirar');
      assert.strictEqual(resValD.body.status, 'EXPIRED', 'Veredito consolidado do status deve ser EXPIRED');

      const denyLogD = mockDatabase.events.find(e => e.event_type === 'access_denied_reason');
      assert.ok(denyLogD);
      assert.strictEqual(denyLogD.metadata.reason, 'EXPIRED', 'Razão auditada deve ser EXPIRED');
    });

    // --- TESTE: Revenue & Churn Analytics Dashboard endpoints ---
    await runTest('Revenue & Churn Analytics Dashboard (Admin vs Non-Admin & Timeline)', async () => {
      const { supabaseAdmin } = await import('../lib/supabase.js');
      const originalGetUserById = supabaseAdmin.auth?.admin?.getUserById;
      
      if (!supabaseAdmin.auth) {
        supabaseAdmin.auth = {};
      }
      if (!supabaseAdmin.auth.admin) {
        supabaseAdmin.auth.admin = {};
      }

      supabaseAdmin.auth.admin.getUserById = async (uid) => {
        if (uid === 'admin-user-id') {
          return {
            data: {
              user: {
                id: uid,
                email: 'admin@flowday.app',
                user_metadata: { is_admin: true }
              }
            },
            error: null
          };
        } else {
          return {
            data: {
              user: {
                id: uid,
                email: 'user@flowday.app',
                user_metadata: { is_admin: false }
              }
            },
            error: null
          };
        }
      };

      // 2. Tentar acessar endpoint como não-admin (deve falhar com 403)
      console.log('   -> Cenário A: Acesso negado para usuário comum');
      const { req: reqNonAdmin, res: resNonAdmin, promise: promiseNonAdmin } = mockReqRes({
        method: 'GET',
        query: { userId: 'normal-user-id' }
      });
      await revenueHandler(reqNonAdmin, resNonAdmin);
      const resultNonAdmin = await promiseNonAdmin;
      assert.strictEqual(resultNonAdmin.statusCode, 403, 'Acesso para não-admin deve ser negado com 403');

      // 3. Tentar acessar endpoint como admin (deve funcionar com 200)
      console.log('   -> Cenário B: Acesso concedido para admin');
      const { req: reqAdmin, res: resAdmin, promise: promiseAdmin } = mockReqRes({
        method: 'GET',
        query: { userId: 'admin-user-id' }
      });
      await revenueHandler(reqAdmin, resAdmin);
      const resultAdmin = await promiseAdmin;
      assert.strictEqual(resultAdmin.statusCode, 200, 'Acesso para admin deve ser permitido com 200');
      assert.ok(resultAdmin.body.kpis, 'Deve conter KPIs de faturamento');
      assert.ok(resultAdmin.body.timeline, 'Deve conter timeline de MRR');

      // 4. Testar timeline de usuário detalhada como admin
      console.log('   -> Cenário C: Acesso de timeline detalhada de usuário');
      const { req: reqTimeline, res: resTimeline, promise: promiseTimeline } = mockReqRes({
        method: 'GET',
        query: { userId: 'admin-user-id', targetUserId: testUserId }
      });
      await userTimelineHandler(reqTimeline, resTimeline);
      const resultTimeline = await promiseTimeline;
      assert.strictEqual(resultTimeline.statusCode, 200, 'Timeline do usuário deve retornar 200');
      assert.strictEqual(resultTimeline.body.userId, testUserId, 'Deve retornar a timeline do targetUserId');
      assert.ok(Array.isArray(resultTimeline.body.timeline), 'Timeline deve ser um array');

      // Restaurar mock
      if (originalGetUserById) {
        supabaseAdmin.auth.admin.getUserById = originalGetUserById;
      }
    });

  } finally {
    globalThis.fetch = originalFetch;

    console.log(`\n========================================`);
    console.log(`📊 RESULTADOS DA SUÍTE DE TESTES (PRODUCTION BD MOCK)`);
    console.log(`========================================`);
    console.log(`🟢 Testes com SUCESSO: ${passed}`);
    console.log(`🔴 Testes com FALHA: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('🎉 Todos os testes de integração e consistência do faturamento passaram com sucesso em escala de produção virtual!');
      process.exit(0);
    }
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
