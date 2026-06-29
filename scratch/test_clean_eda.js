process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';

import { publishEvent } from '../domain/events/eventBus.js';
import eventProcessorHandler from '../api/workers/event-processor.js';
import pingHandler from '../api/workers/ping.js';

console.log('=======================================================');
console.log('⚡ SUÍTE AUTOMATIZADA: CLEAN MODULAR MONOLITH & EDA NÍVEL 2');
console.log('=======================================================');

async function runCleanEdaTest() {
  console.log('\n📌 [TESTE 1] Invocação do Barramento de Eventos de Domínio (EventBus)');
  const evt = await publishEvent('task.created', { taskId: 'task_123', title: 'Test Task' }, 'key_test_123');
  if (!evt || !evt.idempotency_key) throw new Error('TESTE 1 FALHOU: Falha ao publicar evento no EventBus');
  console.log('✓ TESTE 1 PASSOU: Evento task.created publicado com chave de idempotência!');

  console.log('\n📌 [TESTE 2] Invocação Standalone do Worker Event Processor');
  const req = { method: 'GET', headers: {}, query: {} };
  const res = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  await eventProcessorHandler(req, res);
  if (res.statusCode !== 200 || typeof res.body.processed !== 'number') {
    throw new Error(`TESTE 2 FALHOU: Worker event-processor retornou status inesperado ${res.statusCode}`);
  }
  console.log('✓ TESTE 2 PASSOU: Worker event-processor executado com sucesso e resposta homologada!');

  console.log('\n📌 [TESTE 3] Invocação Standalone do Worker Ping (/api/workers/ping)');
  const pingRes = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  pingHandler(req, pingRes);
  if (pingRes.statusCode !== 200 || !pingRes.body.ok) throw new Error('TESTE 3 FALHOU: Ping worker falhou');
  console.log('✓ TESTE 3 PASSOU: /api/workers/ping respondeu HTTP 200!');

  console.log('\n=======================================================');
  console.log('🎉 ARQUITETURA CLEAN MODULAR MONOLITH & EDA NÍVEL 2 HOMOLOGADA!');
  console.log('=======================================================');
}

runCleanEdaTest();
