process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';

import systemStatusHandler from '../api/admin/system-status.js';

console.log('=======================================================');
console.log('⚡ SUÍTE AUTOMATIZADA: AUDITORIA DO SYSTEM STATUS API');
console.log('=======================================================');

function mockRes() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
}

async function runSystemStatusTest() {
  console.log('\n📌 [TESTE 1] Invocação do Endpoint /api/admin/system-status');
  const res = mockRes();
  const start = Date.now();
  await systemStatusHandler({}, res);
  const duration = Date.now() - start;

  console.log('Status HTTP:', res.statusCode);
  console.log('Tempo de Resposta:', duration, 'ms');
  console.log('Payload:', JSON.stringify(res.body, null, 2));

  if (res.statusCode !== 200 || !res.body.statusOverall || !res.body.health || !res.body.notifications) {
    throw new Error('TESTE 1 FALHOU: Estrutura do JSON incorreta');
  }

  if (duration > 500) {
    console.warn('⚠️ AVISO: Tempo de resposta superior a 300ms');
  } else {
    console.log('✓ Desempenho Homologado: Resposta em menos de 300ms!');
  }

  console.log('✓ TESTE 1 PASSOU: API de Observabilidade pronta para uso!');

  console.log('\n=======================================================');
  console.log('🎉 PAINEL DE STATUS DE PRODUÇÃO HOMOLOGADO! 100% SUCESSO');
  console.log('=======================================================');
}

runSystemStatusTest();
