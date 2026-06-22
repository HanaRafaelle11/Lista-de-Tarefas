import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseAdmin = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  console.log("Listing user-defined functions in public schema...");
  
  // Query pg_proc joined with pg_namespace to get functions in 'public' schema
  const { data, error } = await supabaseAdmin
    .from('pg_proc')
    .select(`
      proname,
      prosrc
    `)
    .eq('pronamespace', 2200); // 2200 is typically the OID for public schema
    
  if (error) {
    console.error("❌ Error listing functions:", error.message);
  } else {
    console.log("Found functions:");
    data.forEach(fn => {
      console.log(`- ${fn.proname}`);
    });
  }
}

run();
