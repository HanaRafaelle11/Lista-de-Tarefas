import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const url = envFile.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const key = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const supabase = createClient(url, key);

async function run() {
  console.log("Checking deleted_at column on 'tasks' table...");
  const { data: taskData, error: taskError } = await supabase
    .from('tasks')
    .select('deleted_at')
    .limit(1);

  if (taskError) {
    console.error("Error fetching tasks deleted_at:", taskError);
  } else {
    console.log("Tasks deleted_at check SUCCESS, data:", taskData);
  }

  console.log("Checking deleted_at column on 'goals' table...");
  const { data: goalData, error: goalError } = await supabase
    .from('goals')
    .select('deleted_at')
    .limit(1);

  if (goalError) {
    console.error("Error fetching goals deleted_at:", goalError);
  } else {
    console.log("Goals deleted_at check SUCCESS, data:", goalData);
  }
}

run();
