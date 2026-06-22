import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error("Failed to parse SUPABASE credentials");
  process.exit(1);
}

const supabaseAdmin = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const userId = '0ba573ad-843c-4536-bfdb-e52bad2bed60';
  console.log(`Verifying E2E DB state for user: ${userId}`);
  
  let passed = true;
  
  // 1. Verify profiles
  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('plano, assinatura_status')
    .eq('id', userId)
    .single();
    
  if (profErr || !profile) {
    console.log(`❌ Profile fetch failed: ${profErr?.message || 'No profile row'}`);
    passed = false;
  } else {
    const isPremium = profile.plano === 'premium' && profile.assinatura_status === 'active';
    console.log(`Profile check: plano=${profile.plano}, status=${profile.assinatura_status} -> ${isPremium ? '✅ OK' : '❌ FAILED'}`);
    if (!isPremium) passed = false;
  }
  
  // 2. Verify subscriptions
  const { data: sub, error: subErr } = await supabaseAdmin
    .from('subscriptions')
    .select('status, plan')
    .eq('user_id', userId)
    .maybeSingle();
    
  if (subErr || !sub) {
    console.log(`❌ Subscription check failed: ${subErr?.message || 'No subscription row'}`);
    passed = false;
  } else {
    const isSubActive = sub.status === 'active' && sub.plan === 'premium';
    console.log(`Subscription check: status=${sub.status}, plan=${sub.plan} -> ${isSubActive ? '✅ OK' : '❌ FAILED'}`);
    if (!isSubActive) passed = false;
  }
  
  // 3. Verify billing_events
  const { data: billingEvents, error: bErr } = await supabaseAdmin
    .from('billing_events')
    .select('id, status')
    .eq('user_id', userId);
    
  if (bErr || !billingEvents || billingEvents.length === 0) {
    console.log(`❌ Billing events check failed: ${bErr?.message || 'No billing events found'}`);
    passed = false;
  } else {
    const hasApproved = billingEvents.some(e => e.status === 'approved');
    console.log(`Billing events check: count=${billingEvents.length}, has_approved=${hasApproved} -> ${hasApproved ? '✅ OK' : '❌ FAILED'}`);
    if (!hasApproved) passed = false;
  }
  
  // 4. Verify events
  const { data: events, error: evErr } = await supabaseAdmin
    .from('events')
    .select('event_type')
    .eq('user_id', userId);
    
  if (evErr || !events || events.length === 0) {
    console.log(`❌ Events check failed: ${evErr?.message || 'No events found'}`);
    passed = false;
  } else {
    const hasPaymentApproved = events.some(e => e.event_type === 'payment_approved');
    const hasUserUpgraded = events.some(e => e.event_type === 'user_upgraded');
    console.log(`Events check: payment_approved=${hasPaymentApproved}, user_upgraded=${hasUserUpgraded} -> ${hasPaymentApproved && hasUserUpgraded ? '✅ OK' : '❌ FAILED'}`);
    if (!hasPaymentApproved || !hasUserUpgraded) passed = false;
  }
  
  console.log(`\nOVERALL E2E STATE VERIFICATION: ${passed ? 'PASSOU' : 'FALHOU'}`);
}

run();
