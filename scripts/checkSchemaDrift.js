import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Carregar credenciais
const envPath = path.resolve('.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ Erro: Arquivo .env.local não encontrado.');
  process.exit(1);
}

const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('❌ Erro: Não foi possível obter as credenciais do Supabase no .env.local.');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. Carregar Schema Esperado
const schemaExpectedPath = path.resolve('supabase.schema.expected.json');
if (!fs.existsSync(schemaExpectedPath)) {
  console.error('❌ Erro: supabase.schema.expected.json não encontrado.');
  process.exit(1);
}
const schemaExpected = JSON.parse(fs.readFileSync(schemaExpectedPath, 'utf8'));

async function checkDrift() {
  console.log('🔍 Iniciando verificação de Schema Drift contra o Supabase...');
  let hasDrift = false;
  const results = {};

  // Validar tabelas e colunas
  for (const [table, columns] of Object.entries(schemaExpected.tables)) {
    // Verificar se a tabela existe
    const { error: tableErr } = await supabase.from(table).select('id').limit(0);
    
    if (tableErr && (tableErr.message.includes('Could not find the table') || tableErr.code === 'PGRST116')) {
      results[table] = 'MISSING';
      hasDrift = true;
      continue;
    }

    // Tabela existe, agora verificar colunas obrigatórias
    let columnsOk = true;
    for (const col of columns) {
      const { error: colErr } = await supabase.from(table).select(col).limit(0);
      if (colErr) {
        columnsOk = false;
        results[`${table}.${col}`] = 'MISSING';
        hasDrift = true;
      } else {
        results[`${table}.${col}`] = 'OK';
      }
    }
    
    if (columnsOk) {
      results[table] = 'OK';
    } else {
      results[table] = 'DRIFT DETECTED';
    }
  }

  // Validar Buckets
  for (const bucket of Object.keys(schemaExpected.storage)) {
    const { error: storageErr } = await supabase.storage.from(bucket).list('test-folder', { limit: 1 });
    if (storageErr && storageErr.message.includes('Bucket not found')) {
      results[`${bucket} bucket`] = 'MISSING';
      hasDrift = true;
    } else {
      results[`${bucket} bucket`] = 'OK';
    }
  }

  // Output obrigatório
  console.log('\n=====================================');
  console.log('SCHEMA CHECK RESULT:');
  console.log(JSON.stringify(results, null, 2));
  console.log('=====================================');
  
  if (hasDrift) {
    console.log('\n❌ DRIFT DETECTED: Algumas tabelas, colunas ou buckets estão ausentes no Supabase real.');
    process.exit(1);
  } else {
    console.log('\n🟢 SCHEMA OK: Tudo sincronizado com o Supabase real!');
    process.exit(0);
  }
}

checkDrift().catch(err => {
  console.error('Erro durante o drift check:', err);
  process.exit(1);
});
