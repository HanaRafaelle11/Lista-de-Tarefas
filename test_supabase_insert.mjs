import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreate() {
  const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@flowday.com',
    password: 'senha123'
  });

  if (authError) {
    console.error("Auth failed:", authError.message);
    process.exit(1);
  }

  console.log("Logged in:", session.user.id);

  const clientId = crypto.randomUUID();
  const taskData = {
    title: 'Test direct creation 2',
    description: '',
    category: 'Trabalho',
    priority: 'Média',
    dueDate: null
  };

  console.log("Trying to insert task...");
  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      id:          clientId,
      user_id:     session.user.id,
      title:       taskData.title,
      description: taskData.description || '',
      category:    taskData.category,
      priority:    taskData.priority,
      due_date:    taskData.dueDate || null,
      completed:   false,
      completed_at: null
    }])
    .select()
    .single();

  if (error) {
    console.error("Insert failed:", error);
  } else {
    console.log("Insert success:", data);
    await supabase.from('tasks').delete().eq('id', clientId);
  }
}

testCreate();
