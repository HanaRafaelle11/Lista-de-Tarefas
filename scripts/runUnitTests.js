import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

console.log('🚀 Iniciando Suíte de Testes Unitários das Correções de Produção...\n');

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

process.env.SUPABASE_URL = parseEnv('SUPABASE_URL') || parseEnv('VITE_SUPABASE_URL') || 'https://mftsklhrzhhvtsuamqaw.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = parseEnv('SUPABASE_SERVICE_ROLE_KEY') || 'mock-service-role-key-for-testing';
process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;

let testsCount = 0;
let successCount = 0;
let failCount = 0;

async function runTest(name, fn) {
  testsCount++;
  console.log(`\n[TEST ${testsCount}] ${name}...`);
  try {
    await fn();
    console.log(`✅ ${name} PASS`);
    successCount++;
  } catch (err) {
    console.error(`❌ ${name} FAIL:`, err.message);
    failCount++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 1: withAdminAuth — Acesso sem JWT retorna 403
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('withAdminAuth — Requisição sem JWT retorna 403', async () => {
  const { withAdminAuth } = await import('../lib/auth/withAdminAuth.js');

  let handlerCalled = false;
  const mockHandler = async (req, res) => { handlerCalled = true; };
  const protectedHandler = withAdminAuth(mockHandler);

  let statusCode = null;
  const mockRes = { status(s) { statusCode = s; return this; }, json() { return this; } };

  await protectedHandler({ headers: {}, method: 'GET', url: '/api/admin/dashboard' }, mockRes);
  assert.strictEqual(statusCode, 403, 'Sem JWT deve retornar 403');
  assert.strictEqual(handlerCalled, false, 'Handler não deve executar');
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 2: withAdminAuth — Bypass via query ?userId= retorna 403
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('withAdminAuth — Bypass via query ?userId= retorna 403', async () => {
  const { withAdminAuth } = await import('../lib/auth/withAdminAuth.js');

  let handlerCalled = false;
  const protectedHandler = withAdminAuth(async () => { handlerCalled = true; });

  let statusCode = null;
  const mockRes = { status(s) { statusCode = s; return this; }, json() { return this; } };

  await protectedHandler({
    headers: {},
    query: { userId: 'd3b07384-d113-4ec2-a5e1-8f5b828ef050' },
    method: 'GET',
    url: '/api/admin/dashboard'
  }, mockRes);
  assert.strictEqual(statusCode, 403, 'Bypass via userId query deve retornar 403');
  assert.strictEqual(handlerCalled, false, 'Handler não deve executar');
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 3: withAdminAuth — Bypass via body userId retorna 403
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('withAdminAuth — Bypass via body userId retorna 403', async () => {
  const { withAdminAuth } = await import('../lib/auth/withAdminAuth.js');

  let handlerCalled = false;
  const protectedHandler = withAdminAuth(async () => { handlerCalled = true; });

  let statusCode = null;
  const mockRes = { status(s) { statusCode = s; return this; }, json() { return this; } };

  await protectedHandler({
    headers: {},
    body: { userId: 'd3b07384-d113-4ec2-a5e1-8f5b828ef050' },
    method: 'POST',
    url: '/api/admin/dashboard'
  }, mockRes);
  assert.strictEqual(statusCode, 403, 'Bypass via userId body deve retornar 403');
  assert.strictEqual(handlerCalled, false, 'Handler não deve executar');
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 4: withAdminAuth — Bypass via header x-user-id retorna 403
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('withAdminAuth — Bypass via header x-user-id retorna 403', async () => {
  const { withAdminAuth } = await import('../lib/auth/withAdminAuth.js');

  let handlerCalled = false;
  const protectedHandler = withAdminAuth(async () => { handlerCalled = true; });

  let statusCode = null;
  const mockRes = { status(s) { statusCode = s; return this; }, json() { return this; } };

  await protectedHandler({
    headers: { 'x-user-id': 'd3b07384-d113-4ec2-a5e1-8f5b828ef050' },
    method: 'GET',
    url: '/api/admin/dashboard'
  }, mockRes);
  assert.strictEqual(statusCode, 403, 'Bypass via x-user-id deve retornar 403');
  assert.strictEqual(handlerCalled, false, 'Handler não deve executar');
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 5: withAdminAuth — JWT inválido retorna 403
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('withAdminAuth — JWT inválido retorna 403', async () => {
  const { withAdminAuth } = await import('../lib/auth/withAdminAuth.js');

  let handlerCalled = false;
  const protectedHandler = withAdminAuth(async () => { handlerCalled = true; });

  let statusCode = null;
  const mockRes = { status(s) { statusCode = s; return this; }, json() { return this; } };

  await protectedHandler({
    headers: { authorization: 'Bearer invalid-jwt-token-here' },
    method: 'GET',
    url: '/api/admin/dashboard'
  }, mockRes);
  assert.strictEqual(statusCode, 403, 'JWT inválido deve retornar 403');
  assert.strictEqual(handlerCalled, false, 'Handler não deve executar');
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 6: Ledger Rebuild — Zero Downtime (sem DELETE/TRUNCATE global)
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('Ledger Rebuild — Zero Downtime (sem DELETE/TRUNCATE)', async () => {
  const { BillingEventProjector } = await import('../workers/billing-event-projector.js');

  let deletedTables = new Set();
  let updatedProfilesToFree = false;

  const { supabaseAdmin } = await import('../lib/supabase.js');
  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);

  // Intercepta chamadas ao supabase para detectar operações destrutivas
  supabaseAdmin.from = function(table) {
    const chain = {
      delete() {
        return {
          neq(col, val) { deletedTables.add(table); return Promise.resolve({ data: [], error: null }); }
        };
      },
      update(payload) {
        return {
          neq(col, val) {
            if (table === 'profiles' && payload.plano === 'free') updatedProfilesToFree = true;
            return Promise.resolve({ data: [], error: null });
          },
          eq() { return Promise.resolve({ data: [], error: null }); }
        };
      },
      upsert() { return Promise.resolve({ data: [], error: null }); },
      select() {
        return {
          order() { return Promise.resolve({ data: [], error: null }); },
          eq() { return { maybeSingle() { return Promise.resolve({ data: null, error: null }); } }; }
        };
      }
    };
    return chain;
  };

  try {
    await BillingEventProjector.replayAllEvents();
    assert.strictEqual(deletedTables.has('user_entitlements'), false, 'Não deve deletar user_entitlements');
    assert.strictEqual(deletedTables.has('subscriptions'), false, 'Não deve deletar subscriptions');
    assert.strictEqual(updatedProfilesToFree, false, 'Não deve resetar profiles para free globalmente');
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 7: Replay Idempotente — Rodar duas vezes produz mesmo resultado
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('Ledger Rebuild — Replay idempotente (2 execuções = mesmo estado)', async () => {
  const { BillingEventProjector } = await import('../workers/billing-event-projector.js');

  let projectedEvents = [];
  const mockEvent = {
    id: 'evt_1',
    event_type: 'subscription_activated',
    user_id: 'user_idem_test',
    payment_id: 'pay_1',
    value: 29.90,
    metadata: {
      plan: 'premium',
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      auto_renew: true,
      billing_type: 'pix',
      asaas_customer_id: 'cus_1'
    }
  };

  const { supabaseAdmin } = await import('../lib/supabase.js');
  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);

  const stateStore = {};

  supabaseAdmin.from = function(table) {
    const self = {
      delete() { return { neq() { return Promise.resolve({ data: [], error: null }); } }; },
      update(payload) {
        return {
          eq(col, val) {
            stateStore[`${table}:${val}`] = { ...stateStore[`${table}:${val}`], ...payload };
            const result = { select() { return Promise.resolve({ data: [stateStore[`${table}:${val}`]], error: null }); } };
            return result;
          },
          neq() { return Promise.resolve({ data: [], error: null }); }
        };
      },
      upsert(payload) {
        const p = Array.isArray(payload) ? payload[0] : payload;
        const key = p.user_id || p.id || 'unknown';
        stateStore[`${table}:${key}`] = { ...stateStore[`${table}:${key}`], ...p };
        return Promise.resolve({ data: [stateStore[`${table}:${key}`]], error: null });
      },
      insert(payload) {
        return Promise.resolve({ data: payload, error: null });
      },
      select(cols) {
        return {
          order(col, opts) {
            if (table === 'billing_events') {
              return Promise.resolve({ data: [mockEvent], error: null });
            }
            return Promise.resolve({ data: [], error: null });
          },
          eq() {
            return {
              maybeSingle() { return Promise.resolve({ data: null, error: null }); },
              eq() { return { maybeSingle() { return Promise.resolve({ data: null, error: null }); } }; },
              gt() { return { order() { return { limit() { return { maybeSingle() { return Promise.resolve({ data: null, error: null }); } }; } }; } }; }
            };
          }
        };
      }
    };
    return self;
  };

  // Helper: strip time-dependent fields for comparison
  function stripTimestamps(obj) {
    const clone = JSON.parse(JSON.stringify(obj));
    for (const key of Object.keys(clone)) {
      const record = clone[key];
      if (record && typeof record === 'object') {
        delete record.updated_at;
        delete record.assinatura_inicio;
      }
    }
    return JSON.stringify(clone);
  }

  try {
    // Run 1
    await BillingEventProjector.replayAllEvents();
    const stateAfterRun1 = stripTimestamps(stateStore);

    // Run 2
    await BillingEventProjector.replayAllEvents();
    const stateAfterRun2 = stripTimestamps(stateStore);

    assert.strictEqual(stateAfterRun1, stateAfterRun2, 'Estado após duas execuções de replay deve ser idêntico (ignorando timestamps)');
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 8: DistributedLock — DELETE de expirados roda exatamente 1 vez
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('DistributedLock — DELETE roda exatamente 1 vez + backoff 200ms', async () => {
  const { DistributedLock } = await import('../services/distributed-lock.js');

  let deleteCalls = 0;
  let insertCalls = 0;

  const { supabaseAdmin } = await import('../lib/supabase.js');
  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);

  supabaseAdmin.from = function(table) {
    if (table === 'billing_locks') {
      return {
        delete() {
          return {
            eq() {
              return {
                lt() {
                  deleteCalls++;
                  return Promise.resolve({ error: null });
                }
              };
            },
            count() { return { eq() { return { eq() { return Promise.resolve({ error: null, count: 1 }); } }; } }; }
          };
        },
        insert() {
          insertCalls++;
          if (insertCalls === 1) {
            return Promise.resolve({ error: { code: '23505', message: 'lock held' } });
          }
          return Promise.resolve({ error: null });
        }
      };
    }
    return originalFrom(table);
  };

  try {
    const owner = await DistributedLock.acquire('test-delete-once', {
      lockTimeoutMs: 100,
      acquireTimeoutMs: 2000,
      initialDelayMs: 10
    });

    assert.ok(owner, 'Deve adquirir o lock');
    assert.strictEqual(deleteCalls, 1, 'DELETE de expirados deve rodar exatamente 1 vez');
    assert.strictEqual(insertCalls, 2, 'INSERT deve rodar 2 vezes (1 falha + 1 sucesso)');
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 9: DistributedLock — Duas instâncias, apenas uma adquire
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('DistributedLock — Concorrência: apenas uma instância adquire', async () => {
  const { DistributedLock } = await import('../services/distributed-lock.js');

  let currentLockOwner = null;
  const { supabaseAdmin } = await import('../lib/supabase.js');
  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);

  supabaseAdmin.from = function(table) {
    if (table === 'billing_locks') {
      return {
        delete() {
          return {
            eq() {
              return {
                lt() { return Promise.resolve({ error: null }); }
              };
            },
            count() { return { eq() { return { eq() { 
              currentLockOwner = null;
              return Promise.resolve({ error: null, count: 1 }); 
            } }; } }; }
          };
        },
        insert(payload) {
          const row = Array.isArray(payload) ? payload[0] : payload;
          if (currentLockOwner) {
            return Promise.resolve({ error: { code: '23505', message: 'already held' } });
          }
          currentLockOwner = row.owner;
          return Promise.resolve({ error: null });
        }
      };
    }
    return originalFrom(table);
  };

  try {
    // Primeira instância deve adquirir
    const owner1 = await DistributedLock.acquire('concurrency-test', {
      lockTimeoutMs: 500,
      acquireTimeoutMs: 1000,
      initialDelayMs: 10
    });
    assert.ok(owner1, 'Primeira instância deve adquirir');

    // Segunda instância deve falhar com timeout
    let secondFailed = false;
    try {
      await DistributedLock.acquire('concurrency-test', {
        lockTimeoutMs: 500,
        acquireTimeoutMs: 300,
        initialDelayMs: 10
      });
    } catch (err) {
      secondFailed = true;
      assert.ok(err.message.includes('Timeout'), 'Deve lançar erro de timeout');
    }
    assert.strictEqual(secondFailed, true, 'Segunda instância deve falhar');
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 10: syncQueue — isFlushing impede execução concorrente
// (Teste estrutural: verifica que a flag está presente no código-fonte)
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('syncQueue — isFlushing bloqueia flush concorrente (verificação estrutural)', async () => {
  const syncQueueSource = fs.readFileSync(
    path.resolve('src/services/syncQueue.js'), 'utf8'
  );

  // Verifica que isFlushing é declarado
  assert.ok(
    syncQueueSource.includes('let isFlushing = false'),
    'Deve declarar let isFlushing = false'
  );

  // Verifica que flush() verifica isFlushing antes de processar
  assert.ok(
    syncQueueSource.includes('if (isFlushing) return'),
    'flush() deve retornar imediatamente se isFlushing === true'
  );

  // Verifica que isFlushing = true é setado antes do try
  const flushFn = syncQueueSource.substring(syncQueueSource.indexOf('export async function flush()'));
  const isFLushingTrueIndex = flushFn.indexOf('isFlushing = true');
  const tryIndex = flushFn.indexOf('try {');
  assert.ok(
    isFLushingTrueIndex < tryIndex && isFLushingTrueIndex > 0,
    'isFlushing = true deve ser definido antes do bloco try'
  );

  // Verifica que finally libera a flag
  assert.ok(
    flushFn.includes('} finally {') && flushFn.includes('isFlushing = false'),
    'isFlushing deve ser liberado dentro de finally'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 11: Webhook Deduplicação — Mesmo eventId é processado apenas 1 vez
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('Webhook Asaas — Deduplicação de eventos idênticos', async () => {
  const webhookHandler = (await import('../api-handlers/billing/asaas-webhook.js')).default;

  // Pre-seed: simulate that event 'webhook_event_123' was already processed on a prior call
  const processedEvents = new Set(['webhook_event_123']);
  const webhookEventsInserted = [];

  process.env.ASAAS_WEBHOOK_TOKEN = 'test-webhook-token-123';

  const { supabaseAdmin } = await import('../lib/supabase.js');
  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);

  supabaseAdmin.from = function(table) {
    if (table === 'webhook_events') {
      return {
        select() {
          return {
            eq(col, val) {
              return {
                maybeSingle() {
                  if (processedEvents.has(val)) {
                    return Promise.resolve({ data: { id: val, status: 'processed' }, error: null });
                  }
                  return Promise.resolve({ data: null, error: null });
                }
              };
            }
          };
        },
        insert(payload) {
          const p = Array.isArray(payload) ? payload[0] : payload;
          processedEvents.add(p.event_id);
          webhookEventsInserted.push(p);
          return Promise.resolve({ error: null });
        }
      };
    }
    return originalFrom(table);
  };

  const makeReq = () => ({
    method: 'POST',
    headers: { 'asaas-access-token': 'test-webhook-token-123' },
    socket: { remoteAddress: '127.0.0.1' },
    body: {
      id: 'webhook_event_123',
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_dedup_test',
        customer: 'cus_dedup',
        value: 29.90,
        billingType: 'PIX',
        externalReference: 'mfd_pix_user_dedup_2026-07-03'
      }
    }
  });

  let call200Count = 0;
  let idempotentCount = 0;
  const makeRes = () => {
    let code = null;
    return {
      setHeader() {},
      status(s) { code = s; return this; },
      json(j) {
        if (code === 200) call200Count++;
        if (j && j.idempotent === true) idempotentCount++;
        return this;
      },
      end() { return this; }
    };
  };

  try {
    // Send the same webhook 5 times — all should be detected as already-processed
    for (let i = 0; i < 5; i++) {
      await webhookHandler(makeReq(), makeRes());
    }

    assert.strictEqual(call200Count, 5, 'Todas as 5 chamadas devem retornar 200');
    assert.strictEqual(idempotentCount, 5, 'Todas as 5 chamadas devem retornar idempotent: true');
    // No new 'processed' inserts should have been made (all were caught by the idempotency check)
    const processedInserts = webhookEventsInserted.filter(e => e.status === 'processed');
    assert.strictEqual(processedInserts.length, 0, 'Nenhum insert com status processed deve ser feito para eventos duplicados');
  } finally {
    supabaseAdmin.from = originalFrom;
    delete process.env.ASAAS_WEBHOOK_TOKEN;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 12: OpsMetrics — Incremento e snapshots de métricas operacionais
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('OpsMetrics — Incremento e snapshots corretos', async () => {
  const { OpsMetrics } = await import('../services/ops-metrics.js');

  const before = OpsMetrics.getCounters();
  OpsMetrics.increment('webhook.received');
  OpsMetrics.increment('webhook.idempotent_hits', 2);
  const after = OpsMetrics.getCounters();

  assert.strictEqual(after['webhook.received'], before['webhook.received'] + 1, 'webhook.received deve incrementar 1');
  assert.strictEqual(after['webhook.idempotent_hits'], before['webhook.idempotent_hits'] + 2, 'webhook.idempotent_hits deve incrementar 2');

  OpsMetrics.recordProjectionDelay(100);
  OpsMetrics.recordProjectionDelay(300);
  assert.strictEqual(OpsMetrics.getAvgProjectionDelay(), 200, 'Atraso médio deve ser (100+300)/2 = 200ms');
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 13: Replay Safety Guard — Evitar replays volumosos acidentalmente
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('Replay Safety Guard — Threshold bloqueia sem force=true', async () => {
  const { BillingEventProjector } = await import('../workers/billing-event-projector.js');

  const { supabaseAdmin } = await import('../lib/supabase.js');
  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);

  // Simular 150.000 eventos no banco de dados
  supabaseAdmin.from = function(table) {
    if (table === 'billing_events') {
      return {
        select(cols, opts) {
          if (opts && opts.count === 'exact') {
            return Promise.resolve({ count: 150000, error: null });
          }
          // Para a query real de busca do replay, retornar array vazio
          return {
            order() { return Promise.resolve({ data: [], error: null }); }
          };
        }
      };
    }
    return originalFrom(table);
  };

  try {
    // Caso 1: Sem force=true -> Deve retornar o warning object
    const result1 = await BillingEventProjector.replayAllEvents();
    assert.ok(result1 && result1.warning === true, 'Deve retornar aviso de threshold de segurança');
    assert.strictEqual(result1.count, 150000, 'Aviso deve indicar contagem correta');

    // Caso 2: Com force=true -> Deve prosseguir e retornar true (sucesso)
    const result2 = await BillingEventProjector.replayAllEvents({ force: true });
    assert.strictEqual(result2, true, 'Com force: true deve completar com sucesso');
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 14: Lock Contention Metrics — Registro correto de estatísticas do lock
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('Lock Contention Metrics — Registro correto de tentativas e tempos', async () => {
  const { DistributedLock } = await import('../services/distributed-lock.js');
  const { OpsMetrics } = await import('../services/ops-metrics.js');

  const { supabaseAdmin } = await import('../lib/supabase.js');
  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);

  supabaseAdmin.from = function(table) {
    if (table === 'billing_locks') {
      return {
        delete() { return { eq() { return { lt() { return Promise.resolve({ error: null }); } }; } }; },
        insert() { return Promise.resolve({ error: null }); } // Adquire imediatamente
      };
    }
    return originalFrom(table);
  };

  const beforeAttempts = OpsMetrics.getLockMetrics().total_attempts;
  const beforeAcquired = OpsMetrics.getLockMetrics().total_acquired;

  try {
    const owner = await DistributedLock.acquire('metrics-lock-test', {
      lockTimeoutMs: 50,
      acquireTimeoutMs: 100,
      initialDelayMs: 10
    });
    assert.ok(owner, 'Lock deve ser adquirido');
    
    const metrics = OpsMetrics.getLockMetrics();
    assert.strictEqual(metrics.total_attempts, beforeAttempts + 1, 'Deve incrementar tentativas de lock');
    assert.strictEqual(metrics.total_acquired, beforeAcquired + 1, 'Deve incrementar locks adquiridos');
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});



// ═══════════════════════════════════════════════════════════════════════════════
// TESTE 15: Critical Alerts & Security Logging
// ═══════════════════════════════════════════════════════════════════════════════
await runTest('Critical Alerts — Log de acesso não autorizado e consolidação de alertas', async () => {
  const { withAdminAuth } = await import('../lib/auth/withAdminAuth.js');
  const { supabaseAdmin } = await import('../lib/supabase.js');

  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);
  const eventsInserted = [];

  supabaseAdmin.from = function(table) {
    if (table === 'events') {
      return {
        insert(payload) {
          eventsInserted.push(...payload);
          return Promise.resolve({ error: null });
        }
      };
    }
    return originalFrom(table);
  };

  try {
    // 1. Simular uma requisição não autorizada ao middleware withAdminAuth
    const dummyHandler = async (req, res) => res.status(200).json({ ok: true });
    const protectedHandler = withAdminAuth(dummyHandler);

    let resCode = null;
    let resJson = null;

    const mockReq = {
      headers: {},
      url: '/api/admin/some-secret-route',
      method: 'GET'
    };
    const mockRes = {
      status(code) {
        resCode = code;
        return {
          json(data) {
            resJson = data;
          }
        };
      }
    };

    await protectedHandler(mockReq, mockRes);

    assert.strictEqual(resCode, 403, 'Requisição sem JWT para rota protegida deve retornar 403');
    assert.strictEqual(eventsInserted.length, 1, 'Deve registrar um evento de acesso não autorizado');
    assert.strictEqual(eventsInserted[0].event_type, 'unauthorized_admin_access', 'Tipo de evento deve ser unauthorized_admin_access');
    assert.strictEqual(eventsInserted[0].metadata.path, '/api/admin/some-secret-route');

    // 2. Testar consolidação de alertas na API
    const mockAlertsReq = {
      headers: {
        authorization: 'Bearer valid_jwt_mock'
      }
    };
    
    // Stub supabaseAdmin.auth.getUser para aceitar o mock token como admin
    const originalGetUser = supabaseAdmin.auth.getUser.bind(supabaseAdmin.auth);
    supabaseAdmin.auth.getUser = () => {
      return Promise.resolve({
        data: {
          user: {
            id: 'admin-uuid',
            email: 'admin@flowday.app',
            app_metadata: { role: 'admin' },
            user_metadata: { is_admin: true }
          }
        },
        error: null
      });
    };

    // Mock das tabelas para o endpoint de alertas
    supabaseAdmin.from = function(table) {
      if (table === 'events') {
        return {
          select() {
            return {
              eq(col, val) {
                if (val === 'unauthorized_admin_access') {
                  return {
                    gte() {
                      return {
                        order() {
                          return Promise.resolve({
                            data: [{
                              id: 'auth_alert_1',
                              event_type: 'unauthorized_admin_access',
                              metadata: { email: 'malicious@hacker.com' },
                              created_at: new Date().toISOString()
                            }],
                            error: null
                          });
                        }
                      };
                    }
                  };
                }
                return { gte() { return { order() { return Promise.resolve({ data: [], error: null }); } }; } };
              },
              ilike() {
                return { gte() { return { order() { return Promise.resolve({ data: [], error: null }); } }; } };
              }
            };
          }
        };
      }
      if (table === 'webhook_events') {
        return {
          select() {
            return {
              eq() {
                return {
                  gte() {
                    return {
                      order() {
                        return Promise.resolve({
                          data: [{
                            id: 'webhook_alert_1',
                            event_id: 'err_webhook_1',
                            status: 'error',
                            payload: { message: 'Failed' },
                            created_at: new Date().toISOString()
                          }],
                          error: null
                        });
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }
      if (table === 'billing_events' || table === 'subscriptions' || table === 'user_entitlements') {
        const chainable = {
          select() { return chainable; },
          eq() { return chainable; },
          gte() { return chainable; },
          gt() { return chainable; },
          order() { return chainable; },
          then(resolve) {
            resolve({ data: [], error: null });
          }
        };
        return chainable;
      }
      return originalFrom(table);
    };

    // Importar dinamicamente a rota para testar o handler handleSystemAlerts
    const routesModule = await import('../api/[...routes].js');
    
    // Obter a função handleSystemAlerts do modulo
    let handleSystemAlertsFn = null;
    const routesFileContent = await import('fs');
    const path = await import('path');
    
    // Para chamar o handler de rotas principal, simulamos a rota 'admin/system-alerts'
    const routerHandler = routesModule.default;
    
    let alertsResCode = null;
    let alertsResData = null;
    const mockAlertsRes = {
      status(code) {
        alertsResCode = code;
        return {
          json(data) {
            alertsResData = data;
          }
        };
      },
      setHeader() {},
      headers: {}
    };

    const mockRouterReq = {
      headers: {
        authorization: 'Bearer valid_jwt_mock'
      },
      query: {
        routes: ['admin', 'system-alerts']
      },
      method: 'GET'
    };

    await routerHandler(mockRouterReq, mockAlertsRes);

    assert.strictEqual(alertsResCode, 200, 'Endpoint system-alerts deve retornar status 200');
    assert.ok(Array.isArray(alertsResData), 'Alertas consolidados devem vir em formato de array');
    
    // Deve conter o alerta de auth e o de webhook
    const authAlert = alertsResData.find(a => a.origin === 'auth');
    const webhookAlert = alertsResData.find(a => a.origin === 'billing');
    
    assert.ok(authAlert, 'Deve conter o alerta de segurança (auth)');
    assert.ok(webhookAlert, 'Deve conter o alerta de webhook (billing)');
    assert.strictEqual(authAlert.severity, 'critical', 'Severidade do alerta de auth deve ser critical');
    assert.strictEqual(webhookAlert.severity, 'critical', 'Severidade do alerta de webhook deve ser critical');

    // Restaurar getUser
    supabaseAdmin.auth.getUser = originalGetUser;
  } finally {
    supabaseAdmin.from = originalFrom;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTADO FINAL
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`🏁 Resultado: ${successCount}/${testsCount} Passou | ${failCount} Falhou`);
console.log(`${'═'.repeat(60)}\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 Todas as correções de produção validadas com sucesso!\n');
  process.exit(0);
}
