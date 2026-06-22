import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const serviceKeyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseAdmin = createClient(urlMatch[1].trim(), serviceKeyMatch[1].trim());

async function run() {
  console.log("Attempting to query table constraints...");
  
  // We can try executing a query via REST if information_schema views are exposed.
  // Sometimes supabase doesn't expose information_schema.
  // But we can check if there's any RPC that allows SQL execution.
  // Let's first try to query the REST endpoint for information_schema tables.
  const { data, error } = await supabaseAdmin
    .from('information_schema.check_constraints')
    .select('*')
    .limit(10);
    
  if (error) {
    console.error("Rest error on check_constraints:", error.message);
  } else {
    console.log("Check constraints data:", data);
  }
}

run();
