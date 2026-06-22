import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const serviceKeyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseAdmin = createClient(urlMatch[1].trim(), serviceKeyMatch[1].trim());

async function run() {
  const userId = '0ba573ad-843c-4536-bfdb-e52bad2bed60';
  
  console.log(`Checking profiles row for user ID ${userId}...`);
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
    
  if (error) {
    console.error("❌ Error fetching profile:", error.message);
    process.exit(1);
  }
  
  if (profile) {
    console.log("✅ Profile row exists:", profile);
  } else {
    console.log("⚠️ Profile row is missing! Attempting to insert...");
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        name: 'Tester Flowday E2E 3',
        nickname: 'tester-e2e-3',
        plano: 'free',
        assinatura_status: 'free',
        updated_at: new Date().toISOString()
      })
      .select();
      
    if (insErr) {
      console.error("❌ Failed to insert profile row:", insErr.message);
      console.error(JSON.stringify(insErr, null, 2));
      process.exit(1);
    }
    console.log("✅ Profile row inserted successfully:", inserted[0]);
  }
}

run();
