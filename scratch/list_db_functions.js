import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  try {
    const testEmail = 'teste@flowday.app';
    const testPassword = 'Password123!';
    const loginRes = await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
    if (loginRes.error) throw loginRes.error;
    
    console.log('Logged in.');
    
    // Check if we can query pg_catalog
    const { data, error } = await supabase.from('pg_proc').select('proname').limit(10);
    if (error) {
      console.log('Cannot query pg_proc directly:', error.message);
    } else {
      console.log('Functions from pg_proc:', data);
    }
  } catch (err) {
    console.error(err);
  }
}
run();
