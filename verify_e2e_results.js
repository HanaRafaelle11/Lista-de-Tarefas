import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.resolve('.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local missing');
  process.exit(1);
}
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('❌ Failed to parse .env.local credentials');
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function verifyUser(email, password) {
  console.log(`\n🔑 Realizando login como: ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error(`❌ Erro no login: ${authError.message}`);
    process.exit(1);
  }

  const user = authData.user;
  console.log(`✅ Logado com sucesso! ID do usuário: ${user.id}`);

  // 1. Verificar profiles
  console.log('\n🔍 1. Verificando tabela "profiles"...');
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id);

  if (profErr) {
    console.error(`❌ Erro ao ler profiles: ${profErr.message}`);
  } else if (profiles.length === 0) {
    console.log('❌ Perfil NÃO encontrado.');
  } else {
    console.log('✅ Perfil encontrado no Supabase (trigger funcionou):');
    console.log(JSON.stringify(profiles[0], null, 2));
  }

  // 2. Verificar tasks
  console.log('\n🔍 2. Verificando tabela "tasks"...');
  const { data: tasks, error: taskErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id);

  if (taskErr) {
    console.error(`❌ Erro ao ler tasks: ${taskErr.message}`);
  } else if (tasks.length === 0) {
    console.log('❌ Nenhuma tarefa encontrada.');
  } else {
    console.log(`✅ Tarefas encontradas (${tasks.length}):`);
    tasks.forEach(t => {
      console.log(`   - Título: "${t.title}"`);
      console.log(`     Concluída: ${t.completed}`);
      console.log(`     completed_at: ${t.completed_at}`);
      console.log(`     user_id: ${t.user_id}`);
    });
  }

  // 3. Verificar events
  console.log('\n🔍 3. Verificando tabela "events"...');
  const { data: events, error: eventErr } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', user.id);

  if (eventErr) {
    console.error(`❌ Erro ao ler events: ${eventErr.message}`);
  } else if (events.length === 0) {
    console.log('❌ Nenhum evento encontrado.');
  } else {
    console.log(`✅ Eventos encontrados (${events.length}):`);
    events.forEach(e => {
      console.log(`   - Tipo: ${e.event_type} | Metadata: ${JSON.stringify(e.metadata)} | Criado em: ${e.created_at}`);
    });
  }

  // 4. Verificar storage (avatars)
  console.log('\n🔍 4. Verificando bucket "avatars" no Storage...');
  const { data: files, error: storageErr } = await supabase.storage
    .from('avatars')
    .list(user.id);

  if (storageErr) {
    console.error(`❌ Erro ao listar storage: ${storageErr.message}`);
  } else if (!files || files.length === 0) {
    console.log('❌ Nenhum avatar encontrado no storage.');
  } else {
    console.log(`✅ Arquivos encontrados no storage para o usuário (${files.length}):`);
    files.forEach(f => {
      console.log(`   - ${f.name} (tamanho: ${f.metadata?.size || 'desconhecido'} bytes)`);
    });
  }
}

// Obter argumentos da linha de comando
const email = process.argv[2];
const password = process.argv[3] || 'Test1234!';

if (!email) {
  console.error('❌ Uso: node verify_e2e_results.js <email> [senha]');
  process.exit(1);
}

verifyUser(email, password);
