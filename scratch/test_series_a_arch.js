process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';

import createSubApi from '../api/billing/create-subscription.js';
import statusApi from '../api/billing/status.js';
import accessApi from '../api/auth/access-check.js';
import revenueApi from '../api/analytics/revenue.js';
import adminApi from '../api/admin/dashboard.js';
import pingWorker from '../api/workers/ping.worker.js';

console.log('=======================================================');
console.log('💎 SUÍTE AUTOMATIZADA: AUDITORIA ARQUITETURA SÉRIE A');
console.log('=======================================================');

function mockRes() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
}

async function runSeriesATest() {
  console.log('\n📌 [TESTE 1] Invocação do Thin API Endpoint: /api/billing/create-subscription');
  const res1 = mockRes();
  await createSubApi({ query: {}, body: { userId: 'usr_123', planId: 'pro' } }, res1);
  if (res1.statusCode !== 200 || !res1.body.status) throw new Error('TESTE 1 FALHOU');
  console.log('✓ TESTE 1 PASSOU: /api/billing/create-subscription respondeu HTTP 200!');

  console.log('\n📌 [TESTE 2] Invocação do Thin API Endpoint: /api/billing/status');
  const res2 = mockRes();
  await statusApi({ query: { userId: 'usr_123' } }, res2);
  if (res2.statusCode !== 200) throw new Error('TESTE 2 FALHOU');
  console.log('✓ TESTE 2 PASSOU: /api/billing/status respondeu HTTP 200!');

  console.log('\n📌 [TESTE 3] Invocação do Thin API Endpoint: /api/auth/access-check');
  const res3 = mockRes();
  await accessApi({ query: { userId: 'usr_123' } }, res3);
  if (res3.statusCode !== 200) throw new Error('TESTE 3 FALHOU');
  console.log('✓ TESTE 3 PASSOU: /api/auth/access-check respondeu HTTP 200!');

  console.log('\n📌 [TESTE 4] Invocação do Thin API Endpoint: /api/analytics/revenue');
  const res4 = mockRes();
  await revenueApi({ query: {} }, res4);
  if (res4.statusCode !== 200) throw new Error('TESTE 4 FALHOU');
  console.log('✓ TESTE 4 PASSOU: /api/analytics/revenue respondeu HTTP 200!');

  console.log('\n📌 [TESTE 5] Invocação do Thin API Endpoint: /api/admin/dashboard');
  const res5 = mockRes();
  await adminApi({ query: {} }, res5);
  if (res5.statusCode !== 200) throw new Error('TESTE 5 FALHOU');
  console.log('✓ TESTE 5 PASSOU: /api/admin/dashboard respondeu HTTP 200!');

  console.log('\n📌 [TESTE 6] Invocação do Worker Isolado: ping.worker.js');
  const res6 = mockRes();
  pingWorker({}, res6);
  if (res6.statusCode !== 200 || !res6.body.ok) throw new Error('TESTE 6 FALHOU');
  console.log('✓ TESTE 6 PASSOU: ping.worker.js respondeu HTTP 200!');

  console.log('\n=======================================================');
  console.log('🎉 AUDITORIA ARQUITETURAL SÉRIE A HOMOLOGADA! 100% SUCESSO');
  console.log('=======================================================');
}

runSeriesATest();
