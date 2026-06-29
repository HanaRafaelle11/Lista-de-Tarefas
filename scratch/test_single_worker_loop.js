process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';

import workerLoopHandler from '../api/workers/worker-loop.js';
import { createSubscription } from '../services/billing.service.js';

console.log('=======================================================');
console.log('⚡ SUÍTE AUTOMATIZADA: AUDITORIA DO SINGLE WORKER LOOP');
console.log('=======================================================');

function mockRes() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
}

async function runSingleWorkerLoopTest() {
  console.log('\n📌 [TESTE 1] Execução Direta do Serviço de Faturamento (Billing Service)');
  const sub = await createSubscription({ userId: 'user_test_loop', planId: 'pro', traceId: 'trc_sub_1' });
  if (!sub || !sub.status) throw new Error('TESTE 1 FALHOU');
  console.log('✓ TESTE 1 PASSOU: Serviço de faturamento síncrono executado com sucesso!');

  console.log('\n📌 [TESTE 2] Invocação do Single Worker Loop Serverless Endpoint');
  const res = mockRes();
  await workerLoopHandler({}, res);

  console.log('HTTP Status:', res.statusCode);
  console.log('Resposta JSON:', JSON.stringify(res.body));

  if (res.statusCode !== 200 || !res.body.ok || !res.body.traceId) {
    throw new Error('TESTE 2 FALHOU: Worker loop não respondeu com ok e traceId');
  }
  console.log('✓ TESTE 2 PASSOU: worker-loop.js executou e homologou resumo determinístico!');

  console.log('\n=======================================================');
  console.log('🎉 ARQUITETURA SINGLE WORKER LOOP HOMOLOGADA! 100% SUCESSO');
  console.log('=======================================================');
}

runSingleWorkerLoopTest();
