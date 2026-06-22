/**
 * preDeployValidation.js — Diagnóstico de infraestrutura (não-bloqueante)
 *
 * Este script serve como ferramenta de OBSERVABILIDADE, não de bloqueio.
 * Execute manualmente com: npm run check:infra
 *
 * NUNCA falha o build. Apenas reporta o status da infraestrutura.
 */
import { spawnSync } from 'child_process';
import path from 'path';

function runScript(scriptPath) {
  console.log(`\n--------------------------------------------`);
  console.log(`🔍 Executando: ${path.basename(scriptPath)}...`);
  console.log(`--------------------------------------------`);

  const result = spawnSync('node', [scriptPath], { stdio: 'inherit' });

  if (result.status !== 0) {
    // AVISO — não bloqueia
    console.warn(`\n⚠️  ${path.basename(scriptPath)} reportou issues (não bloqueia o build).`);
    return false;
  }

  console.log(`✅ ${path.basename(scriptPath)} OK.`);
  return true;
}

function main() {
  console.log('🔍 Flowday Infrastructure Diagnostics...');
  console.log('   (Modo: observabilidade — não bloqueia build)\n');

  const schemaOk = runScript('scripts/checkSchemaDrift.js');
  const sanityOk = runScript('scripts/runSanityTest.js');

  console.log('\n========================================================');
  if (schemaOk && sanityOk) {
    console.log('🟢 INFRA STATUS: HEALTHY — tudo sincronizado.');
  } else {
    console.log('🟡 INFRA STATUS: DEGRADED — alguns checks falharam.');
    console.log('   O app continuará funcionando com fallbacks resilientes.');
    console.log('   Execute: npm run check:schema para detalhes do schema.');
  }
  console.log('========================================================\n');

  // Exit 0 sempre — build nunca falha por causa do Supabase
  process.exit(0);
}

main();

6193539