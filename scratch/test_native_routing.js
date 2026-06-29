import fs from 'fs';
import path from 'path';

console.log('=======================================================');
console.log('⚡ SUÍTE AUTOMATIZADA: AUDITORIA DE ROTEAMENTO NATIVO VERCEL');
console.log('=======================================================');

function runNativeRoutingTest() {
  const vercelJsonPath = path.resolve(process.cwd(), 'vercel.json');
  const vercelContent = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));

  console.log('\n📌 [TESTE 1] Verificar remoção de rewrites interceptadores de /api/* em vercel.json');
  const rewrites = vercelContent.rewrites || [];
  const apiRewrite = rewrites.find(r => r.source && r.source.includes('/api/'));

  if (apiRewrite) {
    throw new Error(`TESTE 1 FALHOU: O vercel.json ainda contém um rewrite interceptador de /api/: ${JSON.stringify(apiRewrite)}`);
  }
  console.log('✓ TESTE 1 PASSOU: Nenhum rewrite intercepta a pasta /api/ em vercel.json!');

  console.log('\n📌 [TESTE 2] Verificar existência física dos arquivos de Worker Serverless');
  const pingPath = path.resolve(process.cwd(), 'api/worker/ping.js');
  const notifPath = path.resolve(process.cwd(), 'api/worker/notifications.js');

  if (!fs.existsSync(pingPath)) throw new Error('TESTE 2 FALHOU: Arquivo /api/worker/ping.js não existe');
  if (!fs.existsSync(notifPath)) throw new Error('TESTE 2 FALHOU: Arquivo /api/worker/notifications.js não existe');

  console.log('✓ TESTE 2 PASSOU: Arquivos reais /api/worker/ping.js e /api/worker/notifications.js confirmados!');

  console.log('\n=======================================================');
  console.log('🎉 ROTEAMENTO NATIVO VERCEL HOMOLOGADO! 100% SUCESSO');
  console.log('=======================================================');
}

runNativeRoutingTest();
