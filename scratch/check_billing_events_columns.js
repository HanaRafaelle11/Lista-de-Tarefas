import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const serviceKeyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseAdmin = createClient(urlMatch[1].trim(), serviceKeyMatch[1].trim());

async function run() {
  console.log("Checking columns on billing_events table using supabaseAdmin...");
  const { data, error } = await supabaseAdmin
    .from('billing_events')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error("❌ Error fetching billing_events:", error);
  } else {
    if (data.length > 0) {
      console.log("Columns on billing_events:", Object.keys(data[0]));
    } else {
      console.log("No rows found in billing_events. Attempting to insert a mock row with fields...");
      // Let's try selecting specific columns to see if they fail
      const cols = ["id", "payment_id", "user_id", "status", "created_at"];
      for (const col of cols) {
        const { error: colErr } = await supabaseAdmin
          .from('billing_events')
          .select(col)
          .limit(1);
        if (colErr) {
          console.log(`❌ Column '${col}': NOT found. Error: ${colErr.message}`);
        } else {
          console.log(`✅ Column '${col}': Exists`);
        }
      }
    }
  }
}

run();
