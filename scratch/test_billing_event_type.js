import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const serviceKeyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseAdmin = createClient(urlMatch[1].trim(), serviceKeyMatch[1].trim());

const testTypes = [
  'reconciliation_fix',
  'reconciliation',
  'billing_correction',
  'drift_fix',
  'payment_success',
  'subscription_canceled',
  'subscription_reactivated',
  'payment_failed'
];

async function run() {
  const userId = '0ba573ad-843c-4536-bfdb-e52bad2bed60';
  
  for (const type of testTypes) {
    console.log(`Testing type: "${type}"...`);
    const { data, error } = await supabaseAdmin
      .from('billing_events')
      .insert([{
        user_id: userId,
        type,
        status: 'approved',
        amount: 14.90,
        currency: 'BRL',
        provider: 'test',
        metadata: { payment_id: `test_${type}_${Date.now()}` }
      }])
      .select();
      
    if (error) {
      console.log(`❌ Failed for type "${type}": ${error.message}`);
    } else {
      console.log(`✅ Succeeded for type "${type}"! ID:`, data[0].id);
      await supabaseAdmin.from('billing_events').delete().eq('id', data[0].id);
    }
  }
}

run();
