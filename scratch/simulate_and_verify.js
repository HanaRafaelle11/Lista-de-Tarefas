import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const serviceKeyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

if (!urlMatch || !keyMatch || !serviceKeyMatch) {
  console.error("Credentials missing");
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = keyMatch[1].trim();
const supabaseServiceKey = serviceKeyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const email = 'tester-flowday-e2e-3@gmail.com';
  const password = 'Test1234!';
  
  try {
    // 1. Log in to get the session and userID
    console.log(`[1/3] Logging in as ${email}...`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (authError) {
      console.error("❌ Login failed:", authError.message);
      process.exit(1);
    }
    
    const userId = authData.user.id;
    console.log(`✅ Logged in successfully! User ID: ${userId}`);
    
    // 2. Trigger the local simulation endpoint
    console.log(`[2/3] Triggering /api/dev/simulate-payment...`);
    const response = await fetch('http://localhost:5173/api/dev/simulate-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ API request failed: Status ${response.status}. Details:`, errText);
      process.exit(1);
    }
    
    const apiRes = await response.json();
    console.log(`✅ API Response:`, apiRes);
    
    // 3. Verify Database State
    console.log(`[3/3] Verifying database state...`);
    let passed = true;
    
    // a. Profiles check
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('plano, assinatura_status')
      .eq('id', userId)
      .single();
      
    if (profErr || !profile) {
      console.log(`❌ Profile verification failed: ${profErr?.message || 'No profile row'}`);
      passed = false;
    } else {
      const isPremium = profile.plano === 'premium' && profile.assinatura_status === 'active';
      console.log(`Profiles: plano=${profile.plano}, status=${profile.assinatura_status} -> ${isPremium ? '✅ PASS' : '❌ FAIL'}`);
      if (!isPremium) passed = false;
    }
    
    // b. Subscriptions check
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('status, plan')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (subErr || !sub) {
      console.log(`❌ Subscription verification failed: ${subErr?.message || 'No subscription row'}`);
      passed = false;
    } else {
      const isSubActive = sub.status === 'active' && sub.plan === 'premium';
      console.log(`Subscriptions: status=${sub.status}, plan=${sub.plan} -> ${isSubActive ? '✅ PASS' : '❌ FAIL'}`);
      if (!isSubActive) passed = false;
    }
    
    // c. Billing events check
    const { data: billingEvents, error: bErr } = await supabaseAdmin
      .from('billing_events')
      .select('id, status, type')
      .eq('user_id', userId);
      
    if (bErr || !billingEvents || billingEvents.length === 0) {
      console.log(`❌ Billing events verification failed: ${bErr?.message || 'No billing events'}`);
      passed = false;
    } else {
      const hasApproved = billingEvents.some(e => e.status === 'approved' || e.type === 'payment_approved');
      console.log(`Billing events: count=${billingEvents.length}, has_approved=${hasApproved} -> ${hasApproved ? '✅ PASS' : '❌ FAIL'}`);
      if (!hasApproved) passed = false;
    }
    
    // d. Events check (payment_approved and user_upgraded)
    const { data: events, error: evErr } = await supabaseAdmin
      .from('events')
      .select('event_type')
      .eq('user_id', userId);
      
    if (evErr || !events || events.length === 0) {
      console.log(`❌ Events verification failed: ${evErr?.message || 'No events'}`);
      passed = false;
    } else {
      const hasPaymentApproved = events.some(e => e.event_type === 'payment_approved');
      const hasUserUpgraded = events.some(e => e.event_type === 'user_upgraded');
      console.log(`Events: payment_approved=${hasPaymentApproved}, user_upgraded=${hasUserUpgraded} -> ${hasPaymentApproved && hasUserUpgraded ? '✅ PASS' : '❌ FAIL'}`);
      if (!hasPaymentApproved || !hasUserUpgraded) passed = false;
    }
    
    console.log(`\nRESULT: ${passed ? 'PASSOU' : 'FALHOU'}`);
    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error("❌ Exception during execution:", err);
    process.exit(1);
  }
}

run();
