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
    const userId = loginRes.data.user.id;
    console.log('Logged in. User ID:', userId);

    console.log('Querying dismissed_at column of user_achievements...');
    const { data, error } = await supabase
      .from('user_achievements')
      .select('dismissed_at')
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      console.error('Query error (dismissed_at probably missing):', error);
    } else {
      console.log('Query success! Column exists. Data:', data);
    }
  } catch (err) {
    console.error('Test error:', err);
  }
}
run();
