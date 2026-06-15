import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const email = `test-verify-${Date.now()}@gmail.com`;
  const password = `TestPassword123!`;
  console.log(`Trying signup with ${email}...`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: 'Test Verify' }
    }
  });
  if (error) {
    console.error('Signup error:', error);
  } else {
    console.log('Signup success:', {
      user: data.user ? {
        id: data.user.id,
        email: data.user.email,
        email_confirmed_at: data.user.email_confirmed_at,
        user_metadata: data.user.user_metadata
      } : null,
      session: !!data.session
    });
  }
}

run();
