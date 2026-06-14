import { spawnSync } from 'child_process';
import path from 'path';

function runScript(scriptPath) {
  console.log(`\n--------------------------------------------`);
  console.log(`🚀 Executando: ${path.basename(scriptPath)}...`);
  console.log(`--------------------------------------------`);
  
  const result = spawnSync('node', [scriptPath], { stdio: 'inherit' });
  
  if (result.status !== 0) {
    console.error(`\n❌ Falha no script ${path.basename(scriptPath)} (Exit Code: ${result.status})`);
    return false;
  }
  
  console.log(`✅ Sucesso: ${path.basename(scriptPath)} finalizado.`);
  return true;
}

function main() {
  console.log('🏁 Iniciando Pipeline de Validação Pré-Deploy (Flowday Guard)...');
  
  // Fase 1: Drift Check (Verifica Schema)
  if (!runScript('scripts/checkSchemaDrift.js')) {
    console.error('\n🛑 DEPLOY BLOQUEADO: Falha na verificação de schema (Drift Detected).');
    process.exit(1);
  }
  
  // Fase 2: Sanity Test E2E (Verifica leitura/escrita e storage real)
  if (!runScript('scripts/runSanityTest.js')) {
    console.error('\n🛑 DEPLOY BLOQUEADO: Falha no teste de sanidade E2E do Supabase.');
    process.exit(1);
  }
  
  console.log('\n========================================================');
  console.log('🎉 PIPELINE INTEGRATION STATUS: HEALTHY 🟢');
  console.log('🚀 Todos os testes passaram! Sistema pronto para deploy.');
  console.log('========================================================');
  process.exit(0);
}

main();
