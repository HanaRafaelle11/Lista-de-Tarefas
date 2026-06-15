import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data, error } = await supabase
    .from('events')
    .select('user_id, event_type, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error(error);
  } else {
    const users = {};
    for (const e of data) {
      if (e.metadata && e.metadata.email) {
        users[e.user_id] = e.metadata.email;
      }
    }
    console.log('Found users in events metadata:', users);
  }
}

run();
