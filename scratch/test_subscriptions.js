import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data, error } = await supabase.from('subscriptions').select('*').limit(5);
    if (error) {
      console.error('❌ Error querying subscriptions:', error.message);
    } else {
      console.log('✅ Subscriptions queried successfully. Found records:', data.length);
      console.log('Sample data:', data);
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

run();
