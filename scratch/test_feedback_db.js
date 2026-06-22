import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFeedbackTable() {
  console.log("Checking if 'feedback' table exists by attempting an insert...");
  const { data, error } = await supabase
    .from('feedback')
    .insert({
      message: 'Test message',
      user_email: 'test@example.com',
      created_at: new Date().toISOString()
    })
    .select();

  if (error) {
    console.error("Insert error:", error);
  } else {
    console.log("Insert success! Data:", data);
  }
}

checkFeedbackTable();
