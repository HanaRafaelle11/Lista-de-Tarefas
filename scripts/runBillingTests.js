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
process.env.MERCADOPAGO_ACCESS_TOKEN = parseEnv('MERCADOPAGO_ACCESS_TOKEN') || 'dummy-access-token-for-testing';
process.env.CRON_SECRET = parseEnv('CRON_SECRET') || 'flowday-cron-secret-1234';

// 2. Banco de dados em memória para simulação de queries PostgREST
const mockDatabase = {
  profiles: {},
  billing_events: [],
  payment_events: [],
  payment_ledger: [],
  events: [],
  subscriptions: {},
  billing_idempotency: {},
  billing_locks: {},
  billing_traces: []
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
    const idMatch = query.match(/(?:^|&)id=eq\.([^&]+)/);
    if (idMatch) {
      idEq = decodeURIComponent(idMatch[1]);
    }
    let paymentIdEq = null;
    const paymentIdMatch = query.match(/(?:^|&)(?:payment_id|metadata(?:-%3E%3E|->>)payment_id)=eq\.([^&]+)/);
    if (paymentIdMatch) {
      paymentIdEq = decodeURIComponent(paymentIdMatch[1]);
    }
    let userIdEq = null;
    const userIdMatch = query.match(/(?:^|&)user_id=eq\.([^&]+)/);
    if (userIdMatch) {
      userIdEq = decodeURIComponent(userIdMatch[1]);
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
    } else if (path === 'payment_events') {
      if (method === 'GET') {
        let results = mockDatabase.payment_events;
        if (paymentIdEq) {
          results = results.filter(e => e.payment_id === paymentIdEq);
        }
        if (userIdEq) {
          results = results.filter(e => e.user_id === userIdEq);
        }
        responseData = results;
      } else if (method === 'POST') {
        const records = Array.isArray(body) ? body : [body];
        records.forEach(r => {
          if (r.payment_id) {
            const idx = mockDatabase.payment_events.findIndex(e => e.payment_id === r.payment_id);
            if (idx !== -1) {
              Object.assign(mockDatabase.payment_events[idx], r, {
                processed_at: r.processed_at || new Date().toISOString()
              });
            } else {
              mockDatabase.payment_events.push({ 
                id: r.id || 'pe_mock_' + Math.random().toString(36).substr(2, 9),
                processed_at: r.processed_at || new Date().toISOString(),
                ...r 
              });
            }
          }
        });
        responseData = records;
        responseStatus = 201;
      } else if (method === 'PATCH') {
        if (paymentIdEq) {
          const event = mockDatabase.payment_events.find(e => e.payment_id === paymentIdEq);
          if (event) {
            Object.assign(event, body, {
              processed_at: new Date().toISOString()
            });
            responseData = [event];
          } else {
            responseData = [];
          }
        } else {
          responseData = [];
        }
      } else if (method === 'DELETE') {
        if (userIdEq) {
          mockDatabase.payment_events = mockDatabase.payment_events.filter(e => e.user_id !== userIdEq);
        }
        responseData = [];
      }
    } else if (path === 'payment_ledger') {
      if (method === 'GET') {
        let results = mockDatabase.payment_ledger;
        if (paymentIdEq) {
          results = results.filter(e => e.payment_id === paymentIdEq);
        }
        if (userIdEq) {
          results = results.filter(e => e.user_id === userIdEq);
        }
        responseData = results;
      } else if (method === 'POST') {
        const records = Array.isArray(body) ? body : [body];
        records.forEach(r => {
          mockDatabase.payment_ledger.push({
            id: r.id || 'ledger_mock_' + Math.random().toString(36).substr(2, 9),
            created_at: r.created_at || new Date().toISOString(),
            ...r
          });
        });
        responseData = records;
        responseStatus = 201;
      } else if (method === 'DELETE' || method === 'PATCH') {
        return {
          ok: false,
          status: 405,
          statusText: 'Method Not Allowed',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'method_not_allowed', message: 'payment_ledger is append-only' }),
          text: async () => JSON.stringify({ error: 'method_not_allowed', message: 'payment_ledger is append-only' })
        };
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
    } else if (path === 'subscriptions') {
      if (method === 'GET') {
        let results = Object.values(mockDatabase.subscriptions);
        if (userIdEq) {
          results = results.filter(s => s.user_id === userIdEq);
        }
        if (idEq) {
          results = results.filter(s => s.id === idEq);
        }
        responseData = results;
      } else if (method === 'POST') {
        const records = Array.isArray(body) ? body : [body];
        records.forEach(r => {
          mockDatabase.subscriptions[r.user_id] = {
            id: r.id || 'sub_mock_' + Math.random().toString(36).substr(2, 9),
            created_at: r.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...r
          };
        });
        responseData = records;
        responseStatus = 201;
      } else if (method === 'PATCH') {
        let sub = null;
        if (userIdEq) {
          sub = mockDatabase.subscriptions[userIdEq];
        } else if (idEq) {
          sub = Object.values(mockDatabase.subscriptions).find(s => s.id === idEq);
        }
        if (sub) {
          Object.assign(sub, body, { updated_at: new Date().toISOString() });
          responseData = [sub];
        } else {
          responseData = [];
        }
      } else if (method === 'DELETE') {
        if (userIdEq) {
          delete mockDatabase.subscriptions[userIdEq];
        }
        responseData = [];
      }
    } else if (path === 'billing_idempotency') {
      console.log(`[MOCK DB] billing_idempotency: method=${method}, query=${query}, body=`, JSON.stringify(body));
      if (method === 'GET') {
        let results = Object.values(mockDatabase.billing_idempotency);
        const keyMatch = query.match(/(?:^|&)key=eq\.([^&]+)/);
        if (keyMatch) {
          const keyEq = decodeURIComponent(keyMatch[1]);
          results = results.filter(r => r.key === keyEq);
        }
        responseData = results;
      } else if (method === 'POST' || method === 'PUT') {
        const records = Array.isArray(body) ? body : [body];
        records.forEach(r => {
          const existing = mockDatabase.billing_idempotency[r.key] || {};
          mockDatabase.billing_idempotency[r.key] = {
            ...existing,
            ...r,
            created_at: existing.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        });
        responseData = records;
        responseStatus = 201;
      } else if (method === 'PATCH') {
        const keyMatch = query.match(/(?:^|&)key=eq\.([^&]+)/);
        if (keyMatch) {
          const keyEq = decodeURIComponent(keyMatch[1]);
          const existing = mockDatabase.billing_idempotency[keyEq];
          if (existing) {
            Object.assign(existing, body, { updated_at: new Date().toISOString() });
            responseData = [existing];
          } else {
            responseData = [];
          }
        } else {
          responseData = [];
        }
      }
    } else if (path === 'billing_locks') {
      if (method === 'DELETE') {
        const keyMatch = query.match(/(?:^|&)key=eq\.([^&]+)/);
        const ownerMatch = query.match(/(?:^|&)owner=eq\.([^&]+)/);
        const expiresAtLtMatch = query.match(/(?:^|&)expires_at=lt\.([^&]+)/);

        let deletedCount = 0;
        if (keyMatch) {
          const keyEq = decodeURIComponent(keyMatch[1]);
          const existing = mockDatabase.billing_locks[keyEq];
          
          if (existing) {
            let matches = true;
            if (ownerMatch) {
              const ownerEq = decodeURIComponent(ownerMatch[1]);
              if (existing.owner !== ownerEq) matches = false;
            }
            if (expiresAtLtMatch) {
              const expiresAtLt = new Date(decodeURIComponent(expiresAtLtMatch[1]));
              const lockExpiry = new Date(existing.expires_at);
              if (lockExpiry >= expiresAtLt) matches = false;
            }
            
            if (matches) {
              delete mockDatabase.billing_locks[keyEq];
              deletedCount = 1;
            }
          }
        }
        responseData = deletedCount > 0 ? [{}] : [];
      } else if (method === 'POST') {
        const records = Array.isArray(body) ? body : [body];
        let duplicate = false;
        for (const r of records) {
          if (mockDatabase.billing_locks[r.key]) {
            duplicate = true;
            break;
          }
        }
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
        records.forEach(r => {
          mockDatabase.billing_locks[r.key] = {
            ...r,
            created_at: r.created_at || new Date().toISOString()
          };
        });
        responseData = records;
        responseStatus = 201;
      }
    } else if (path === 'billing_traces') {
      if (method === 'POST') {
        const records = Array.isArray(body) ? body : [body];
        records.forEach(r => {
          mockDatabase.billing_traces.push({
            trace_id: r.trace_id || crypto.randomUUID(),
            timestamp: r.timestamp || new Date().toISOString(),
            ...r
          });
        });
        responseData = records;
        responseStatus = 201;
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
const revenueIntegrityHandler = (await import('../api/analytics/revenue-integrity.js')).default;

const { supabaseAdmin } = await import('../lib/supabase.js');
if (!supabaseAdmin.auth) {
  supabaseAdmin.auth = {};
}
if (!supabaseAdmin.auth.admin) {
  supabaseAdmin.auth.admin = {};
}
supabaseAdmin.auth.admin.getUserById = async (uid) => {
  if (uid === 'invalid-email-user-id') {
    return {
      data: {
        user: {
          id: uid,
          email: 'test_user@test.com',
          user_metadata: {}
        }
      },
      error: null
    };
  }
  if (uid === testUserId) {
    return {
      data: {
        user: {
          id: uid,
          email: testUserEmail,
          user_metadata: {}
        }
      },
      error: null
    };
  }
  return {
    data: {
      user: {
        id: uid,
        email: `${uid}@flowday.app`,
        user_metadata: { is_admin: uid === 'admin-user-id' }
      }
    },
    error: null
  };
};

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
    send(body) {
      this.body = body;
      resolved(this);
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    end(body) {
      if (body) this.body = body;
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
  mockDatabase.subscriptions = {};

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
        body: {
          userId: testUserId,
          cpf: '29009941019'
        }
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
        body: {
          userId: testUserId,
          cpf: '29009941019'
        }
      });

      reactivateHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200, 'Status deve ser 200');
      assert.ok(result.body.preferenceId, 'Deve retornar um preferenceId');
      assert.strictEqual(mockFetchPreferences.length, 1, 'Deve ter chamado a API do Mercado Pago');
      assert.strictEqual(mockFetchPreferences[0].body.items[0].unit_price, 11.90, 'Preço de reativação deve ser 11.90 (20% desconto)');
      assert.strictEqual(mockFetchPreferences[0].body.metadata.offer_type, 'reactivation_discount', 'Deve carregar metadado da oferta');
    });

    // --- TESTE 2.1: Checkout fails with generic name ---
    await runTest('Checkout Creation - Generic Name Fails', async () => {
      mockDatabase.profiles[testUserId].name = 'Usuario';
      mockDatabase.profiles[testUserId].nickname = 'FlowDay';

      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: {
          userId: testUserId,
          cpf: '29009941019'
        }
      });

      checkoutHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 400, 'Status deve ser 400');
      assert.strictEqual(result.body.error, 'Nome e sobrenome válidos são obrigatórios para prosseguir.');

      // Restore profile name
      mockDatabase.profiles[testUserId].name = 'Test Runner Billing';
      mockDatabase.profiles[testUserId].nickname = null;
    });

    // --- TESTE 2.2: Checkout succeeds with updated profile name in DB ---
    await runTest('Checkout Creation - Updated profile name in DB succeeds', async () => {
      mockFetchPreferences = [];
      mockDatabase.profiles[testUserId].name = 'John Doe';

      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: {
          userId: testUserId,
          cpf: '29009941019'
        }
      });

      checkoutHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200, 'Status deve ser 200');
      assert.ok(result.body.preferenceId, 'Deve retornar um preferenceId');
      assert.strictEqual(mockFetchPreferences[0].body.payer.first_name, 'John');
      assert.strictEqual(mockFetchPreferences[0].body.payer.last_name, 'Doe');

      // Restore profile name
      mockDatabase.profiles[testUserId].name = 'Test Runner Billing';
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
      mockDatabase.subscriptions[testUserId] = {
        user_id: testUserId,
        status: 'active',
        plan: 'premium',
        current_period_end: null
      };
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
      mockDatabase.subscriptions[testUserId] = {
        user_id: testUserId,
        status: 'free',
        plan: 'free',
        current_period_end: null
      };
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
      mockDatabase.subscriptions[testUserId] = {
        user_id: testUserId,
        status: 'canceled',
        plan: 'premium',
        current_period_end: futureDate.toISOString()
      };

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
      mockDatabase.subscriptions[testUserId] = {
        user_id: testUserId,
        status: 'canceled',
        plan: 'premium',
        current_period_end: pastDate.toISOString()
      };
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

    // --- TESTE 9: Hardening V2 — Reprocessamento Idempotente do Webhook ---
    await runTest('Hardening V2 - Webhook Duplicate Reprocessing', async () => {
      mockDatabase.payment_events = [];
      mockDatabase.billing_events = [];
      mockDatabase.events = [];
      mockDatabase.profiles[testUserId].plano = 'free';
      mockDatabase.profiles[testUserId].assinatura_status = 'free';

      const paymentId = 'pay_h2_dup_' + Date.now();
      mockFetchPayments[paymentId] = {
        id: paymentId,
        status: 'approved',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_test_123' },
        date_approved: new Date().toISOString()
      };

      // Primeiro envio (Aprovação)
      const { req: req1, res: res1, promise: promise1 } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });
      webhookHandler(req1, res1);
      const result1 = await promise1;
      assert.strictEqual(result1.statusCode, 200);

      // Segundo envio (Duplicado)
      const { req: req2, res: res2, promise: promise2 } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });
      webhookHandler(req2, res2);
      const result2 = await promise2;

      // Deve responder 200 com billingResult indicando duplicado
      assert.strictEqual(result2.statusCode, 200);
      assert.ok(result2.body && result2.body.billingResult && result2.body.billingResult.duplicated === true, 'Deve indicar duplicado no billingResult');
    });

    // --- TESTE 10: Hardening V2 — Status Pending Não Libera Premium ---
    await runTest('Hardening V2 - Webhook Pending Does Not Grant Premium', async () => {
      mockDatabase.payment_events = [];
      mockDatabase.billing_events = [];
      mockDatabase.profiles[testUserId].plano = 'free';
      mockDatabase.profiles[testUserId].assinatura_status = 'free';

      const paymentId = 'pay_h2_pend_' + Date.now();
      mockFetchPayments[paymentId] = {
        id: paymentId,
        status: 'pending',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_test_123' }
      };

      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });
      webhookHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(mockDatabase.profiles[testUserId].plano, 'free', 'O plano deve continuar como free');
      assert.strictEqual(mockDatabase.profiles[testUserId].assinatura_status, 'free', 'Status da assinatura deve continuar free');
    });

    // --- TESTE 11: Hardening V2 — CPF Inválido Bloqueia Criação de Pagamento ---
    await runTest('Hardening V2 - Invalid CPF Blocks Payment Creation', async () => {
      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: {
          token: 'card_token_123',
          payment_method_id: 'master',
          amount: 14.90,
          userId: testUserId,
          cpf: '123.456.789-00' // CPF inválido matemático
        }
      });

      const paymentsCreateHandler = (await import('../api/payments/create.js')).default;
      paymentsCreateHandler(req, res);
      const result = await promise;
      assert.strictEqual(result.statusCode, 400, 'Deve retornar erro 400');
      assert.strictEqual(result.body.error, 'CPF inválido.', 'Deve acusar CPF inválido');
    });

    // --- TESTE 12: Hardening V2 — Email Inválido ou Teste Bloqueia Criação de Pagamento ---
    await runTest('Hardening V2 - Invalid Email Blocks Payment Creation', async () => {
      mockDatabase.profiles['invalid-email-user-id'] = {
        id: 'invalid-email-user-id',
        name: 'Valid User',
        nickname: 'valid'
      };

      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: {
          token: 'card_token_123',
          payment_method_id: 'master',
          amount: 14.90,
          userId: 'invalid-email-user-id',
          cpf: '29009941019' // CPF válido matemático
        }
      });

      const paymentsCreateHandler = (await import('../api/payments/create.js')).default;
      paymentsCreateHandler(req, res);
      const result = await promise;
      assert.strictEqual(result.statusCode, 400, 'Deve retornar erro 400');
      assert.strictEqual(result.body.error, 'Email obrigatório.', 'Deve acusar Email obrigatório para test_user@test.com');

      delete mockDatabase.profiles['invalid-email-user-id'];
    });

    // --- TESTE 12.1: Payment Creation - Generic Name Fails ---
    await runTest('Hardening V2 - Generic Name Blocks Payment Creation', async () => {
      mockDatabase.profiles[testUserId].name = 'Usuario';
      mockDatabase.profiles[testUserId].nickname = 'FlowDay';

      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: {
          token: 'card_token_123',
          payment_method_id: 'master',
          amount: 14.90,
          userId: testUserId,
          cpf: '29009941019' // CPF válido matemático
        }
      });

      const paymentsCreateHandler = (await import('../api/payments/create.js')).default;
      paymentsCreateHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 400, 'Deve retornar erro 400');
      assert.strictEqual(result.body.error, 'Nome e sobrenome válidos são obrigatórios para prosseguir.');

      // Restore profile name
      mockDatabase.profiles[testUserId].name = 'Test Runner Billing';
      mockDatabase.profiles[testUserId].nickname = null;
    });

    // --- TESTE 13: Hardening V3 — Webhook Replay & Ledger Idempotency ---
    await runTest('Hardening V3 - Webhook Replay & Ledger Idempotency', async () => {
      mockDatabase.payment_events = [];
      mockDatabase.payment_ledger = [];
      mockDatabase.profiles[testUserId].plano = 'free';
      mockDatabase.profiles[testUserId].assinatura_status = 'free';

      const paymentId = 'pay_h3_replay_' + Date.now();
      mockFetchPayments[paymentId] = {
        id: paymentId,
        status: 'approved',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_test_123' },
        date_approved: new Date().toISOString()
      };

      // Primeiro webhook (deve transicionar status e criar registros no ledger)
      const { req: req1, res: res1, promise: promise1 } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });
      await webhookHandler(req1, res1);
      const result1 = await promise1;
      assert.strictEqual(result1.statusCode, 200);

      // Segundo webhook (replay - deve ser ignorado sem reprocessar premium)
      const { req: req2, res: res2, promise: promise2 } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });
      await webhookHandler(req2, res2);
      const result2 = await promise2;
      assert.strictEqual(result2.statusCode, 200);
      assert.strictEqual(result2.body.billingResult.duplicated, true);

      // Validar ledger (deve conter webhook_received, payment_created, status_updated para o primeiro, e webhook_received, webhook_ignored para o segundo)
      const ledgerEvents = mockDatabase.payment_ledger.filter(e => e.payment_id === paymentId);
      assert.ok(ledgerEvents.length >= 4, 'Ledger deve conter múltiplos registros do ciclo de vida');

      const eventTypes = ledgerEvents.map(e => e.event_type);
      assert.ok(eventTypes.includes('webhook_received'));
      assert.ok(eventTypes.includes('payment_created'));
      assert.ok(eventTypes.includes('status_updated'));
      assert.ok(eventTypes.includes('webhook_ignored'), 'Deve ter registrado webhook_ignored para o replay');
    });

    // --- TESTE 14: Hardening V3 — Reconciliation Correcting Divergent States ---
    await runTest('Hardening V3 - Reconciliation Correcting Divergent States', async () => {
      // Caso 1: MP = approved, DB = pending -> deve se tornar reconciled e liberar premium
      mockDatabase.payment_events = [];
      mockDatabase.payment_ledger = [];
      mockFetchPayments = {};
      mockFetchPreapprovals = [];
      mockDatabase.profiles[testUserId].plano = 'free';
      mockDatabase.profiles[testUserId].assinatura_status = 'free';

      const paymentId1 = 'pay_h3_recon_app_' + Date.now();
      
      // Inserir estado inicial como 'pending' no banco local
      mockDatabase.payment_events.push({
        payment_id: paymentId1,
        status: 'pending',
        user_id: testUserId,
        plan: 'premium',
        processed_at: new Date().toISOString()
      });

      // Configurar retorno de Mercado Pago como 'approved'
      mockFetchPayments[paymentId1] = {
        id: paymentId1,
        status: 'approved',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_test_123' },
        date_approved: new Date().toISOString()
      };

      const { req: req1, res: res1, promise: promise1 } = mockReqRes({
        method: 'GET',
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
      });

      await reconcileHandler(req1, res1);
      const result1 = await promise1;

      assert.strictEqual(result1.statusCode, 200);
      assert.strictEqual(result1.body.discrepanciesFixed, 1, 'Deve fixar 1 inconsistência');

      // Perfil local deve estar premium e ativo
      assert.strictEqual(mockDatabase.profiles[testUserId].plano, 'premium');
      assert.strictEqual(mockDatabase.profiles[testUserId].assinatura_status, 'active');

      // Tabela de status local deve estar 'reconciled'
      const statusEvent1 = mockDatabase.payment_events.find(e => e.payment_id === paymentId1);
      assert.strictEqual(statusEvent1.status, 'reconciled', 'Estado final na tabela de status deve ser reconciled');

      // Caso 2: MP = rejected, DB = pending -> deve se tornar rejected e remover premium (se tivesse)
      mockDatabase.payment_events = [];
      mockFetchPayments = {};
      mockFetchPreapprovals = [];
      mockDatabase.profiles[testUserId].plano = 'free';
      mockDatabase.profiles[testUserId].assinatura_status = 'free';

      const paymentId2 = 'pay_h3_recon_rej_' + Date.now();
      mockDatabase.payment_events.push({
        payment_id: paymentId2,
        status: 'pending',
        user_id: testUserId,
        plan: 'premium',
        processed_at: new Date().toISOString()
      });

      mockFetchPayments[paymentId2] = {
        id: paymentId2,
        status: 'rejected',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_test_123' }
      };

      const { req: req2, res: res2, promise: promise2 } = mockReqRes({
        method: 'GET',
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
      });

      await reconcileHandler(req2, res2);
      const result2 = await promise2;

      assert.strictEqual(result2.statusCode, 200);
      assert.strictEqual(result2.body.discrepanciesFixed, 1);

      const statusEvent2 = mockDatabase.payment_events.find(e => e.payment_id === paymentId2);
      assert.strictEqual(statusEvent2.status, 'rejected', 'Deve ter transicionado local para rejected');
    });

    // --- TESTE 15: Hardening V3 — State Machine Transition Blocks ---
    await runTest('Hardening V3 - State Machine Transition Blocks', async () => {
      const { PaymentStateMachine } = await import('../services/payment-state-machine.js');

      // approved para pending deve ser bloqueado
      assert.strictEqual(PaymentStateMachine.isValidTransition('approved', 'pending'), false);

      // rejected ou cancelled são terminais e devem bloquear qualquer transição
      assert.strictEqual(PaymentStateMachine.isValidTransition('rejected', 'approved'), false);
      assert.strictEqual(PaymentStateMachine.isValidTransition('cancelled', 'reconciled'), false);

      // reconciled só pode ocorrer após approved ou pending
      assert.strictEqual(PaymentStateMachine.isValidTransition('approved', 'reconciled'), true);
      assert.strictEqual(PaymentStateMachine.isValidTransition('pending', 'reconciled'), true);
      assert.strictEqual(PaymentStateMachine.isValidTransition('in_process', 'reconciled'), false);
      assert.strictEqual(PaymentStateMachine.isValidTransition('created', 'reconciled'), false);
    });

    // --- TESTE 16: Hardening V3 — Ledger is Append-Only ---
    await runTest('Hardening V3 - Ledger is Append-Only', async () => {
      // Simular chamada de PATCH para o Supabase (PostgREST) na rota payment_ledger
      const patchUrl = `${supabaseUrl}/rest/v1/payment_ledger?id=eq.any_id`;
      const response = await fetch(patchUrl, {
        method: 'PATCH',
        body: JSON.stringify({ status_normalized: 'hacked' })
      });

      assert.strictEqual(response.status, 405, 'PATCH deve ser bloqueado com 405 Method Not Allowed');

      const deleteUrl = `${supabaseUrl}/rest/v1/payment_ledger?id=eq.any_id`;
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE'
      });

      assert.strictEqual(deleteResponse.status, 405, 'DELETE deve ser bloqueado com 405 Method Not Allowed');
    });

    // --- TESTE 17: Subscription Expiration Removes Premium ---
    await runTest('Subscription Expiration Removes Premium', async () => {
      mockDatabase.subscriptions[testUserId] = {
        id: 'sub_test_exp_123',
        user_id: testUserId,
        status: 'active',
        plan: 'premium',
        price: 14.90,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() - 3600000).toISOString(), // expired 1 hour ago
        provider: 'mercado_pago'
      };

      const { req, res, promise } = mockReqRes({
        method: 'GET',
        query: { userId: testUserId }
      });
      await checkAccessHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body.isPro, false, 'Expired subscription must deny Pro access');
      assert.strictEqual(result.body.status, 'EXPIRED', 'Reason must be EXPIRED');
    });

    // --- TESTE 18: Failed Payment webhook sets Past_Due ---
    await runTest('Failed Payment webhook sets Past_Due', async () => {
      mockDatabase.subscriptions[testUserId] = {
        id: 'sub_test_fail_123',
        user_id: testUserId,
        status: 'active',
        plan: 'premium',
        price: 14.90,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 86400000 * 30).toISOString(),
        provider: 'mercado_pago'
      };
      mockDatabase.payment_events = [];
      mockDatabase.payment_ledger = [];

      const paymentId = 'pay_failed_webhook_' + Date.now();
      mockFetchPayments[paymentId] = {
        id: paymentId,
        status: 'rejected',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_fail_123' }
      };

      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });
      await webhookHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(mockDatabase.subscriptions[testUserId].status, 'past_due', 'Webhook for failed payment must transition status to past_due');
    });

    // --- TESTE 19: Past_Due has No Premium Access ---
    await runTest('Past_Due has No Premium Access', async () => {
      mockDatabase.subscriptions[testUserId] = {
        id: 'sub_test_past_due_123',
        user_id: testUserId,
        status: 'past_due',
        plan: 'premium',
        price: 14.90,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 86400000 * 30).toISOString(),
        provider: 'mercado_pago'
      };

      const { req, res, promise } = mockReqRes({
        method: 'GET',
        query: { userId: testUserId }
      });
      await checkAccessHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(result.body.isPro, false, 'Past due subscription must deny Pro access');
      assert.strictEqual(result.body.status, 'PAST_DUE', 'Reason must be PAST_DUE');
    });

    // --- TESTE 20: Successful Retry Restores Access ---
    await runTest('Successful Retry Restores Access', async () => {
      mockDatabase.subscriptions[testUserId] = {
        id: 'sub_test_dunning_123',
        user_id: testUserId,
        status: 'past_due',
        plan: 'premium',
        price: 14.90,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 86400000 * 30).toISOString(),
        provider: 'mercado_pago',
        metadata: {
          retry_attempts: 1,
          simulate_dunning_failure: false
        }
      };

      const { runDunning } = await import('../jobs/subscription-dunning.js');
      const dunningResult = await runDunning();

      assert.ok(dunningResult.success);
      assert.strictEqual(dunningResult.recovered, 1, 'Should recover 1 subscription');
      assert.strictEqual(mockDatabase.subscriptions[testUserId].status, 'active', 'Should transition subscription to active');
    });

    // --- TESTE 21: Billing Cycle Generates Charge ---
    await runTest('Billing Cycle Generates Charge', async () => {
      mockDatabase.subscriptions[testUserId] = {
        id: 'sub_test_billing_cycle_123',
        user_id: testUserId,
        status: 'active',
        plan: 'premium',
        price: 14.90,
        current_period_start: new Date(Date.now() - 86400000 * 35).toISOString(),
        current_period_end: new Date(Date.now() - 86400000 * 5).toISOString(), // expired 5 days ago
        provider: 'mercado_pago',
        metadata: {
          email: testUserEmail,
          simulate_failure: false
        }
      };

      const { runBillingCycle } = await import('../jobs/subscription-billing-cycle.js');
      const cycleResult = await runBillingCycle();

      assert.ok(cycleResult.success);
      assert.strictEqual(cycleResult.successes, 1, 'Should charge and renew subscription');
      assert.strictEqual(mockDatabase.subscriptions[testUserId].status, 'active');
      
      const newExpiry = new Date(mockDatabase.subscriptions[testUserId].current_period_end);
      assert.ok(newExpiry > new Date(), 'Period end should be pushed to the future');
    });

    // --- TESTE 22: Webhook Does Not Directly Grant Access ---
    await runTest('Webhook Does Not Directly Grant Access', async () => {
      delete mockDatabase.subscriptions[testUserId];
      mockDatabase.profiles[testUserId].plano = 'free';
      mockDatabase.profiles[testUserId].assinatura_status = 'free';
      mockDatabase.payment_events = [];
      mockDatabase.payment_ledger = [];

      const paymentId = 'pay_webhook_indirect_' + Date.now();
      mockFetchPayments[paymentId] = {
        id: paymentId,
        status: 'approved',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_webhook_ind_123' },
        date_approved: new Date().toISOString()
      };

      const { req: req1, res: res1, promise: promise1 } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });
      await webhookHandler(req1, res1);
      await promise1;

      const { req: req2, res: res2, promise: promise2 } = mockReqRes({
        method: 'GET',
        query: { userId: testUserId }
      });
      await checkAccessHandler(req2, res2);
      const accessResult = await promise2;

      assert.strictEqual(accessResult.body.isPro, true, 'Access must be granted after webhook processing');
      assert.strictEqual(accessResult.body.status, 'ACTIVE', 'Access reason must be ACTIVE');
      
      const ledgerEvents = mockDatabase.payment_ledger.filter(e => e.payment_id === paymentId);
      assert.ok(ledgerEvents.length >= 2, 'Webhook should update status and record in ledger first');
    });

    // --- TESTE 23: Revenue Integrity Endpoint ---
    await runTest('Revenue Integrity Endpoint', async () => {
      const { supabaseAdmin } = await import('../lib/supabase.js');
      const originalGetUserById = supabaseAdmin.auth?.admin?.getUserById;
      
      if (!supabaseAdmin.auth) {
        supabaseAdmin.auth = {};
      }
      if (!supabaseAdmin.auth.admin) {
        supabaseAdmin.auth.admin = {};
      }

      supabaseAdmin.auth.admin.getUserById = async (uid) => {
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
      };

      const { req, res, promise } = mockReqRes({
        method: 'GET',
        query: { userId: testUserId }
      });
      await revenueIntegrityHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200);
      assert.ok(result.body.success);
      assert.ok(result.body.metrics.mrr >= 0);

      // Restore mock
      if (originalGetUserById) {
        supabaseAdmin.auth.admin.getUserById = originalGetUserById;
      }
    });

    // --- TESTE 24: Webhook Concurrent Duplicate Processing ---
    await runTest('Production Hardening - Concurrent Webhook Duplicates', async () => {
      mockDatabase.payment_events = [];
      mockDatabase.payment_ledger = [];
      mockDatabase.billing_idempotency = {};
      mockDatabase.billing_locks = {};

      const paymentId = 'pay_concurrent_dup_' + Date.now();
      mockFetchPayments[paymentId] = {
        id: paymentId,
        status: 'approved',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_concurrent_123' },
        date_approved: new Date().toISOString()
      };

      const req1 = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });
      const req2 = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });

      const [res1, res2] = await Promise.all([
        (async () => {
          await webhookHandler(req1.req, req1.res);
          return await req1.promise;
        })(),
        (async () => {
          await webhookHandler(req2.req, req2.res);
          return await req2.promise;
        })()
      ]);

      assert.strictEqual(res1.statusCode, 200);
      assert.strictEqual(res2.statusCode, 200);

      const duplicateDetected = 
        (res1.body?.billingResult?.duplicated === true) || 
        (res2.body?.billingResult?.duplicated === true);
      assert.ok(duplicateDetected, 'Uma das requisições simultâneas deve ser identificada como duplicada');
    });

    // --- TESTE 25: Webhook Out-of-Order Events ---
    await runTest('Production Hardening - Out-of-Order Webhook Prevention', async () => {
      mockDatabase.billing_idempotency = {};
      mockDatabase.billing_locks = {};
      
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 10);
      
      mockDatabase.subscriptions[testUserId] = {
        id: 'sub_order_123',
        user_id: testUserId,
        status: 'active',
        plan: 'premium',
        price: 14.90,
        current_period_start: new Date().toISOString(),
        current_period_end: futureDate.toISOString(),
        provider: 'mercado_pago',
        updated_at: futureDate.toISOString()
      };

      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 10);

      const paymentId = 'pay_old_event_' + Date.now();
      mockFetchPayments[paymentId] = {
        id: paymentId,
        status: 'rejected',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_old_123' },
        date_approved: pastDate.toISOString(),
        date_last_updated: pastDate.toISOString()
      };

      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });
      await webhookHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200);
      assert.ok(result.body.ignored || (result.body.billingResult && result.body.billingResult.ignored) || result.body.status === 'active', 'O evento antigo deve ser ignorado ou manter status active');
      assert.strictEqual(mockDatabase.subscriptions[testUserId].status, 'active', 'A assinatura mais recente não deve sofrer regressão');
    });

    // --- TESTE 26: Chaos Engine DB failure and Retry recovery ---
    await runTest('Production Hardening - Database Failure Simulation and Retry', async () => {
      const { ChaosEngine } = await import('../services/chaos-engine.js');
      mockDatabase.billing_idempotency = {};
      mockDatabase.billing_locks = {};
      mockDatabase.payment_events = [];

      const paymentId = 'pay_chaos_retry_' + Date.now();
      mockFetchPayments[paymentId] = {
        id: paymentId,
        status: 'approved',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_chaos_123' },
        date_approved: new Date().toISOString()
      };

      ChaosEngine.enableBehavior('db_write_failure');

      setTimeout(() => {
        ChaosEngine.disableBehavior('db_write_failure');
      }, 80);

      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });
      await webhookHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(mockDatabase.subscriptions[testUserId].status, 'active', 'Devem ser aplicados os dados após retentativas com sucesso');
    });

    // --- TESTE 27: Concurrency lock behavior under crash (Lock Timeout) ---
    await runTest('Production Hardening - Lock Cleanup on Crash (Timeout)', async () => {
      mockDatabase.billing_locks = {};
      mockDatabase.billing_idempotency = {};

      const expiredDate = new Date(Date.now() - 10000);
      mockDatabase.billing_locks[`subscription:${testUserId}`] = {
        key: `subscription:${testUserId}`,
        owner: 'orphan-owner-id',
        expires_at: expiredDate.toISOString(),
        created_at: expiredDate.toISOString()
      };

      const paymentId = 'pay_lock_timeout_' + Date.now();
      mockFetchPayments[paymentId] = {
        id: paymentId,
        status: 'approved',
        transaction_amount: 14.90,
        metadata: { user_id: testUserId },
        payer: { id: 'cust_timeout_123' },
        date_approved: new Date().toISOString()
      };

      const { req, res, promise } = mockReqRes({
        method: 'POST',
        body: { type: 'payment', data: { id: paymentId } }
      });
      await webhookHandler(req, res);
      const result = await promise;

      assert.strictEqual(result.statusCode, 200);
      assert.strictEqual(mockDatabase.subscriptions[testUserId].status, 'active', 'Deve conseguir limpar o lock expirado e processar');
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
