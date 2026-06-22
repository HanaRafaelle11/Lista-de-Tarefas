import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const serviceKeyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseAdmin = createClient(urlMatch[1].trim(), serviceKeyMatch[1].trim());
const testUserId = '0ba573ad-843c-4536-bfdb-e52bad2bed60';

async function main() {
  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', testUserId).single();
  console.log("Profile:", profile);

  const { data: subscriptions } = await supabaseAdmin.from('subscriptions').select('*').eq('user_id', testUserId);
  console.log("Subscriptions:", subscriptions);

  const { data: billingEvents } = await supabaseAdmin.from('billing_events').select('*').eq('user_id', testUserId);
  console.log("Billing Events:", billingEvents);

  const { data: events } = await supabaseAdmin.from('events').select('*').eq('user_id', testUserId);
  console.log("Events:", events);
}

main();
