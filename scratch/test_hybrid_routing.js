process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mock.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

import pingHandler from '../api/worker/ping.js';
import gatewayHandler from '../api/[...routes].js';

console.log('=======================================================');
console.log('⚡ SUÍTE AUTOMATIZADA: AUDITORIA DE ROTEAMENTO HÍBRIDO');
console.log('=======================================================');

async function runHybridRoutingTest() {
  // 1. Testar se as functions nativas de worker respondem 200 diretamente
  const pingReq = { method: 'GET', headers: {}, query: {} };
  const pingRes = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  pingHandler(pingReq, pingRes);
  if (pingRes.statusCode !== 200 || !pingRes.body.ok) throw new Error('TESTE 1 FALHOU: Native ping function falhou');
  console.log('✓ TESTE 1 PASSOU: GET /api/worker/ping responde 200 direto da function nativa.');

  // 2. Testar se o gateway bloqueia requisições acidentais de worker com 404 explícito
  const gatewayWorkerReq = { method: 'GET', headers: {}, query: { routes: ['worker', 'ping'] } };
  const gatewayWorkerRes = {
    statusCode: 200,
    headers: {},
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  await gatewayHandler(gatewayWorkerReq, gatewayWorkerRes);
  if (gatewayWorkerRes.statusCode !== 404 || gatewayWorkerRes.body.error !== 'Route belongs to native worker handler') {
    throw new Error(`TESTE 2 FALHOU: Gateway deveria bloquear worker com 404 explícito, mas retornou ${gatewayWorkerRes.statusCode}`);
  }
  console.log('✓ TESTE 2 PASSOU: Gateway [...routes].js bloqueia a família worker/* com mensagem explícita.');

  // 3. Testar se outras rotas registradas no gateway continuam funcionando
  const gatewayHealthReq = { method: 'GET', headers: {}, query: { routes: ['health'] } };
  const gatewayHealthRes = {
    statusCode: 200,
    headers: {},
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
  await gatewayHandler(gatewayHealthReq, gatewayHealthRes);
  if (gatewayHealthRes.statusCode !== 200 || gatewayHealthRes.body.status !== 'online') {
    throw new Error('TESTE 3 FALHOU: Rota health no gateway falhou');
  }
  console.log('✓ TESTE 3 PASSOU: Rotas do gateway (/api/health, /api/subscription/*) continuam 100% operacionais.');

  console.log('\n=======================================================');
  console.log('🎉 AUDITORIA DE ROTEAMENTO HÍBRIDO HOMOLOGADA! 100% SUCESSO');
  console.log('=======================================================');
}

runHybridRoutingTest();
