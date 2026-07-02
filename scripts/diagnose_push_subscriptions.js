import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[Diagnostic] Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runDiagnostics() {
  console.log('=== PUSH SUBSCRIPTIONS DIAGNOSTIC TOOL ===');
  console.log(`Supabase URL: ${supabaseUrl}`);
  
  // 1. Fetch push subscriptions count
  console.log('\n--- 1. Checking Database Subscriptions ---');
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('*')
    .order('updated_at', { ascending: false });

  if (subErr) {
    console.error('[Error] Failed to fetch push_subscriptions:', subErr.message);
    return;
  }

  console.log(`Total subscriptions found: ${subs.length}`);
  if (subs.length > 0) {
    console.log('\nLatest Subscriptions:');
    subs.slice(0, 5).forEach((sub, i) => {
      console.log(`[${i + 1}] ID: ${sub.id}`);
      console.log(`    User ID: ${sub.user_id}`);
      console.log(`    Endpoint: ${sub.endpoint.substring(0, 60)}...`);
      console.log(`    Has p256dh: ${!!sub.p256dh}`);
      console.log(`    Has auth: ${!!sub.auth}`);
      console.log(`    Updated At: ${sub.updated_at}`);
    });
  } else {
    console.log('[Warn] No active push subscriptions found in the database. Users need to grant permission and register.');
  }

  // 2. Checking Telemetry logs
  console.log('\n--- 2. Checking Push Telemetry Logs ---');
  const { data: logs, error: logErr } = await supabase
    .from('push_telemetry')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (logErr) {
    console.warn('[Warning] Failed to fetch push_telemetry (table may not exist or RLS blocked):', logErr.message);
  } else {
    console.log(`Recent telemetry entries found: ${logs.length}`);
    logs.forEach((log) => {
      console.log(`[${log.created_at}] Event: ${log.event_type} | Status: ${log.status} | Step/Details: ${log.endpoint} | Error: ${log.error || 'None'}`);
    });
  }

  // 3. Output VAPID config recommendations
  console.log('\n--- 3. Production VAPID Secrets Configuration ---');
  console.log('Ensure the VAPID keys set in your production Supabase Edge Functions match the client:');
  console.log(`Public Key: ${process.env.VITE_PUBLIC_VAPID_KEY}`);
  console.log(`Private Key: ${process.env.PRIVATE_VAPID_KEY ? '[PRESENT]' : '[MISSING]'}`);
  console.log('\nTo set these secrets in production, run the following CLI command:');
  console.log(`supabase secrets set --project-ref mftsklhrzhhvtsuamqaw VAPID_PUBLIC_KEY="${process.env.VITE_PUBLIC_VAPID_KEY}" VAPID_PRIVATE_KEY="${process.env.PRIVATE_VAPID_KEY || 'SUA_CHAVE_PRIVADA'}"`);
}

runDiagnostics().catch(console.error);
