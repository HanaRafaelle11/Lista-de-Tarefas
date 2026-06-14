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

async function checkTester() {
  console.log('🔍 Buscando registros do testador "tester-flowday-e2e-3@gmail.com" no Supabase remetente...');
  
  // Buscar no profiles
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .ilike('name', '%Sanity%');

  if (profErr) {
    console.error('❌ Erro ao ler tabela profiles:', profErr.message);
  } else {
    console.log(`✅ Perfis encontrados (${profiles.length}):`, profiles);
    
    if (profiles.length > 0) {
      const userId = profiles[0].id;

      // Buscar tarefas
      const { data: tasks, error: taskErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId);

      if (taskErr) {
        console.error('❌ Erro ao ler tabela tasks:', taskErr.message);
      } else {
        console.log(`✅ Tarefas encontradas para o usuário (${tasks.length}):`, tasks);
      }

      // Buscar eventos
      const { data: events, error: eventErr } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId);

      if (eventErr) {
        console.error('❌ Erro ao ler tabela events:', eventErr.message);
      } else {
        console.log(`✅ Eventos registrados para o usuário (${events.length}):`, events);
      }
    }
  }
}

checkTester();
