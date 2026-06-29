process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';

import { processGrowthOSEngine } from '../domain/growth/growthEngine.js';
import growthIntelHandler from '../api/admin/growth/intelligence.js';

console.log('=======================================================');
console.log('⚡ SUÍTE AUTOMATIZADA: AUDITORIA DO GROWTH OPERATING SYSTEM (GROWTH OS)');
console.log('=======================================================');

function mockRes() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
}

async function runGrowthOSTest() {
  console.log('\n📌 [TESTE 1] Invocação do Motor de Domínio Growth OS (risk, leaks, actions, closed-loop)');
  const engineResult = await processGrowthOSEngine({ traceId: 'trc_test_growth_1' });
  console.log('Resultado do Engine:', JSON.stringify(engineResult));
  if (!engineResult || typeof engineResult.riskEvaluated !== 'number') {
    throw new Error('TESTE 1 FALHOU: Falha ao executar o motor Growth OS');
  }
  console.log('✓ TESTE 1 PASSOU: Motor Growth OS executado e regras de negócio processadas!');

  console.log('\n📌 [TESTE 2] Invocação da API de Inteligência (/api/admin/growth/intelligence)');
  const res = mockRes();
  await growthIntelHandler({}, res);

  console.log('Status HTTP:', res.statusCode);
  console.log('Payload Inteligência:', JSON.stringify(res.body, null, 2));

  if (res.statusCode !== 200 || !res.body.riskSummary || !res.body.revenueLeaks || !res.body.closedLoop) {
    throw new Error('TESTE 2 FALHOU: Estrutura do payload de inteligência incorreta');
  }
  console.log('✓ TESTE 2 PASSOU: API de Inteligência respondeu HTTP 200 com métricas de decisão!');

  console.log('\n=======================================================');
  console.log('🎉 AUDITORIA DO GROWTH OPERATING SYSTEM HOMOLOGADA! 100% SUCESSO');
  console.log('=======================================================');
}

runGrowthOSTest();
