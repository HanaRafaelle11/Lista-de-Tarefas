import handler from '../api/worker/ping.js';

console.log('=======================================================');
console.log('⚡ SUÍTE AUTOMATIZADA: AUDITORIA DO WORKER DE PING');
console.log('=======================================================');

async function runWorkerPingTest() {
  const req = { method: 'GET', headers: {}, query: {} };
  const res = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };

  console.log('\n📌 [TESTE 1] Execução Direta do Handler do Ping Worker');
  handler(req, res);

  console.log('HTTP Status:', res.statusCode);
  console.log('Resposta JSON:', JSON.stringify(res.body));

  if (res.statusCode !== 200 || !res.body.ok || res.body.service !== 'worker-ping') {
    throw new Error(`TESTE 1 FALHOU: Resposta do ping worker incorreta`);
  }

  console.log('✓ TESTE 1 PASSOU: Endpoint /api/worker/ping responde HTTP 200 com payload esperado!');

  console.log('\n=======================================================');
  console.log('🎉 AUDITORIA DO WORKER DE PING HOMOLOGADA! 100% SUCESSO');
  console.log('=======================================================');
}

runWorkerPingTest();
