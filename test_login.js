import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function tryLogin(email, password) {
  console.log(`Trying login for ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.log(`Failed: ${error.message}`);
    return null;
  } else {
    console.log(`Success! Logged in as ${email}. User ID: ${data.user.id}`);
    return data;
  }
}

async function run() {
  await tryLogin('admin@flowday.app', 'Test1234!');
  await tryLogin('rafaelle@flowday.app', 'Test1234!');
  await tryLogin('rafox@flowday.app', 'Test1234!');
  await tryLogin('admin@flowday.app', 'Admin123!');
  await tryLogin('tester-flowday-e2e-3@gmail.com', 'Test1234!');
}

run();
