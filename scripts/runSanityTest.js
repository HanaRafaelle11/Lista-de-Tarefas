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

async function runSanity() {
  console.log('🧪 Iniciando Teste de Sanidade E2E Integrado...');
  
  const testEmail = `sanity-test-${Date.now()}@flowday.app`;
  const testPassword = `SanityTestPass123!`;
  
  // 1. Criar usuário teste
  console.log('- Passo 1: Criando usuário de teste...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: { data: { name: 'Sanity Test User' } }
  });
  if (authError) throw new Error(`SignUp falhou: ${authError.message}`);
  const user = authData.user;
  console.log(`  ✅ Usuário criado com UUID: ${user.id}`);

  // Aguardar trigger criar profiles
  console.log('  Aguardando 2 segundos para o trigger criar o perfil...');
  await new Promise(r => setTimeout(r, 2000));

  // 2. Verificar perfil automático
  console.log('- Passo 2: Verificando criação de perfil via trigger...');
  const { data: profileData, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id);
  if (profileErr) throw new Error(`Falha ao ler perfil: ${profileErr.message}`);
  if (profileData.length === 0) throw new Error('O trigger de banco de dados não criou o perfil.');
  console.log('  ✅ Perfil detectado:', profileData[0]);

  // 3. Criar tarefa
  console.log('- Passo 3: Criando tarefa de teste...');
  const { data: taskData, error: taskErr } = await supabase
    .from('tasks')
    .insert({
      title: 'Sanity Test Task',
      description: 'E2E Validation',
      category: 'Trabalho',
      priority: 'Alta',
      user_id: user.id
    })
    .select();
  if (taskErr) throw new Error(`Falha ao criar tarefa: ${taskErr.message}`);
  console.log('  ✅ Tarefa criada:', taskData[0]);
  const taskId = taskData[0].id;

  // 4. Completar tarefa (gerar completed_at)
  console.log('- Passo 4: Concluindo tarefa para testar completed_at...');
  const completedAt = new Date().toISOString();
  const { data: completedTask, error: completeErr } = await supabase
    .from('tasks')
    .update({ completed: true, completed_at: completedAt })
    .eq('id', taskId)
    .select();
  if (completeErr) throw new Error(`Falha ao concluir tarefa: ${completeErr.message}`);
  if (!completedTask[0].completed_at) throw new Error('O campo completed_at não foi gravado no banco.');
  console.log('  ✅ completed_at gravado:', completedTask[0].completed_at);

  // 5. Gerar evento analítico
  console.log('- Passo 5: Gerando evento analítico de teste...');
  const { data: eventData, error: eventErr } = await supabase
    .from('events')
    .insert({
      user_id: user.id,
      event_type: 'sanity_test_run',
      metadata: { tested: true }
    })
    .select();
  if (eventErr) throw new Error(`Falha ao registrar evento: ${eventErr.message}`);
  console.log('  ✅ Evento persistido no Supabase:', eventData[0]);

  // 6. Upload de avatar
  console.log('- Passo 6: Testando upload de avatar no Storage...');
  const dummyFile = Buffer.from('dummy image content for E2E sanity test');
  const fileName = `${user.id}/avatar-sanity.png`;
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(fileName, dummyFile, { contentType: 'image/png', upsert: true });
  if (uploadErr) throw new Error(`Upload de avatar falhou: ${uploadErr.message}`);
  console.log('  ✅ Upload concluído com sucesso!');

  // 7. Ler tudo de volta do Supabase e validar
  console.log('- Passo 7: Validando consistência de dados remota...');
  const { data: listStorage, error: listStorageErr } = await supabase.storage
    .from('avatars')
    .list(user.id);
  if (listStorageErr) throw new Error(`Erro ao listar storage: ${listStorageErr.message}`);
  if (listStorage.length === 0) throw new Error('O arquivo carregado não foi encontrado no Storage.');

  // 8. Limpeza dos dados de teste
  console.log('- Passo 8: Executando limpeza dos registros temporários...');
  await supabase.storage.from('avatars').remove([fileName]);
  await supabase.from('tasks').delete().eq('id', taskId);
  await supabase.from('events').delete().eq('id', eventData[0].id);
  console.log('  ✅ Limpeza concluída.');

  console.log('\n🟢 SANITY TEST PASSED: Todo o fluxo E2E Supabase está 100% funcional!');
  process.exit(0);
}

runSanity().catch(err => {
  console.error('\n❌ SANITY TEST FAILED:', err.message);
  process.exit(1);
});
