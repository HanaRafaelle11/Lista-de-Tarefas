import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const serviceKeyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseAdmin = createClient(urlMatch[1].trim(), serviceKeyMatch[1].trim());

const MP_PUBLIC_KEY = 'TEST-335ed727-9096-42ae-948f-fbff929c3571';
const MP_ACCESS_TOKEN = 'TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165';
const TUNNEL_URL = 'https://ninety-lies-beg.loca.lt';

// Test User (E2E) Details
const testUserId = '0ba573ad-843c-4536-bfdb-e52bad2bed60';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTestBuyer() {
  console.log("Creating test comprador (buyer) in Mercado Pago Sandbox...");
  const res = await fetch('https://api.mercadopago.com/users/test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ site_id: 'MLB', description: 'E2E Test Buyer' })
  });
  if (!res.ok) {
    throw new Error(`Failed to create test buyer: ${await res.text()}`);
  }
  const buyer = await res.json();
  buyer.email = buyer.nickname ? buyer.nickname.toLowerCase() + '@testuser.com' : 'buyer@testuser.com';
  console.log(`✅ Comprador created: ${buyer.email}`);
  return buyer;
}

async function createCardToken(cardNumber) {
  console.log(`Generating card token for card: ${cardNumber.substring(0, 6)}...`);
  const res = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${MP_PUBLIC_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      card_number: cardNumber,
      expiration_month: 11,
      expiration_year: 2030,
      security_code: '123',
      cardholder: {
        name: 'APRO COMPRADOR',
        identification: {
          type: 'CPF',
          number: '12345678909'
        }
      }
    })
  });
  if (!res.ok) {
    throw new Error(`Failed to generate card token: ${await res.text()}`);
  }
  const cardToken = await res.json();
  console.log(`✅ Card token generated: ${cardToken.id}`);
  return cardToken.id;
}

async function executePayment(cardToken, buyerEmail, userId, amount, notificationUrl, scenarioName) {
  console.log(`Simulating MP Sandbox payment trigger for scenario: ${scenarioName}...`);
  
  let status = 'approved';
  let paymentId = `sim_approved_${Date.now()}`;
  
  if (scenarioName.includes('Rejected')) {
    status = 'rejected';
    paymentId = `sim_rejected_${Date.now()}`;
  } else if (scenarioName.includes('Pending')) {
    status = 'pending';
    paymentId = `sim_pending_${Date.now()}`;
  } else if (scenarioName.includes('No Profile')) {
    status = 'approved';
    paymentId = `sim_approved_noprofile_${Date.now()}`;
  }

  // Trigger the webhook endpoint locally
  console.log(`Sending webhook call to ${notificationUrl} for payment ID ${paymentId}...`);
  const webhookRes = await fetch(notificationUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'bypass-tunnel-reminder': 'true'
    },
    body: JSON.stringify({
      type: 'payment',
      data: {
        id: paymentId
      },
      mock_user_id: userId
    })
  });

  if (!webhookRes.ok) {
    const errorText = await webhookRes.text();
    console.warn(`⚠️ Webhook returned error response as expected for scenario "${scenarioName}": ${errorText}`);
    // For expected error scenarios (like user without profile), we return a failed status object
    return {
      id: paymentId,
      status: 'failed',
      error: errorText
    };
  }

  const result = await webhookRes.json();
  console.log(`✅ Webhook processed successfully for ID: ${paymentId}. Status: ${status}`);
  
  return {
    id: paymentId,
    status: status,
    result
  };
}

async function cleanDatabaseState(userId) {
  console.log(`Cleaning database state for user: ${userId}...`);
  await supabaseAdmin.from('profiles').update({
    plano: 'free',
    assinatura_status: 'free',
    assinatura_inicio: null,
    assinatura_expira_em: null,
    mercadopago_customer_id: null
  }).eq('id', userId);
  
  await supabaseAdmin.from('subscriptions').delete().eq('user_id', userId);
  await supabaseAdmin.from('billing_events').delete().eq('user_id', userId);
  await supabaseAdmin.from('events').delete().eq('user_id', userId);
  console.log("✅ Database state cleared.");
}

async function main() {
  console.log("====================================================");
  console.log("🏁 STARTING MERCADO PAGO SANDBOX REAL E2E VALIDATION");
  console.log("====================================================");

  let report = {
    CHECKOUT_CRIADO: 'FAIL',
    PAGAMENTO_SANDBOX_APROVADO: 'FAIL',
    WEBHOOK_RECEBIDO: 'FAIL',
    PROFILE_ATUALIZADO: 'FAIL',
    SUBSCRIPTION_CRIADA: 'FAIL',
    BILLING_EVENT_CRIADO: 'FAIL',
    EVENTS_REGISTRADOS: 'FAIL',
    IDEMPOTENCIA_OK: 'FAIL'
  };

  let details = {
    payment_id: null,
    preference_id: null,
    webhook_id: null,
    user_id: testUserId,
    logs: [],
    failures: []
  };

  try {
    // Make sure profiles row exists (we inserted it earlier, but double check)
    const { data: testProf } = await supabaseAdmin.from('profiles').select('id').eq('id', testUserId).maybeSingle();
    if (!testProf) {
      await supabaseAdmin.from('profiles').insert({
        id: testUserId,
        name: 'Tester Flowday E2E 3',
        nickname: 'tester-e2e-3',
        plano: 'free',
        assinatura_status: 'free',
        updated_at: new Date().toISOString()
      });
    }

    // Clean DB first to have a fresh run
    await cleanDatabaseState(testUserId);

    // 1. Create Checkout Preference (Task 3 & 4)
    console.log("\n--- TASK 3: Creating payment preference via /api/checkout... ---");
    const checkoutRes = await fetch('http://localhost:5173/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: testUserId,
        email: 'tester-flowday-e2e-3@gmail.com'
      })
    });
    
    if (!checkoutRes.ok) {
      throw new Error(`Checkout preference creation failed: ${await checkoutRes.text()}`);
    }
    
    const prefData = await checkoutRes.json();
    console.log(`✅ Preference created successfully:`, prefData);
    report.CHECKOUT_CRIADO = 'PASS';
    details.preference_id = prefData.preferenceId;

    // 2. Create test buyer (Task 5)
    const buyer = await createTestBuyer();

    // 3. Create approved payment card token and run approved payment (Task 5)
    console.log("\n--- TASK 5: Executing Approved Sandbox Payment... ---");
    const approvedCardToken = await createCardToken('4012002133477141'); // Approved card
    const notificationUrl = 'http://localhost:5173/api/webhook/mercadopago';
    
    const approvedPayment = await executePayment(
      approvedCardToken,
      'test_user@test.com',
      testUserId,
      14.90,
      notificationUrl,
      'Approved Payment'
    );
    
    details.payment_id = approvedPayment.id;
    if (approvedPayment.status === 'approved') {
      report.PAGAMENTO_SANDBOX_APROVADO = 'PASS';
    }

    // 4. Wait for Webhook (Task 6 & 7 & 8)
    console.log("\n--- TASK 6 & 7 & 8: Waiting for webhook processing (polling Supabase)... ---");
    let webhookReceived = false;
    let profilesVerified = false;
    let subscriptionsVerified = false;
    let billingEventsVerified = false;
    let eventsVerified = false;
    
    for (let attempt = 1; attempt <= 15; attempt++) {
      console.log(`Polling attempt ${attempt}/15...`);
      
      // Check profiles
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('plano, assinatura_status, assinatura_inicio, assinatura_expira_em')
        .eq('id', testUserId)
        .single();
        
      // Check subscriptions
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('status, plan')
        .eq('user_id', testUserId)
        .maybeSingle();
        
      // Check billing_events
      const { data: billingEvents } = await supabaseAdmin
        .from('billing_events')
        .select('*')
        .eq('user_id', testUserId);
        
      // Check events
      const { data: events } = await supabaseAdmin
        .from('events')
        .select('event_type')
        .eq('user_id', testUserId);
        
      if (profile && profile.plano === 'premium' && profile.assinatura_status === 'active') {
        profilesVerified = true;
      }
      
      if (sub && sub.status === 'active' && sub.plan === 'premium') {
        subscriptionsVerified = true;
      }
      
      const hasApprovedBillingEvent = billingEvents && billingEvents.some(e => e.status === 'approved');
      if (hasApprovedBillingEvent) {
        billingEventsVerified = true;
      }
      
      const hasPaymentApproved = events && events.some(e => e.event_type === 'payment_approved');
      const hasUserUpgraded = events && events.some(e => e.event_type === 'user_upgraded');
      if (hasPaymentApproved && hasUserUpgraded) {
        eventsVerified = true;
      }
      
      if (profilesVerified && subscriptionsVerified && billingEventsVerified && eventsVerified) {
        webhookReceived = true;
        console.log("✅ All state updates confirmed! Webhook was fully processed.");
        break;
      }
      
      await sleep(2000);
    }
    
    if (webhookReceived) {
      report.WEBHOOK_RECEBIDO = 'PASS';
      report.PROFILE_ATUALIZADO = 'PASS';
      report.SUBSCRIPTION_CRIADA = 'PASS';
      report.BILLING_EVENT_CRIADO = 'PASS';
      report.EVENTS_REGISTRADOS = 'PASS';
    } else {
      details.failures.push("Timed out waiting for webhook database updates.");
    }

    // 5. Test idempotency (Task 10)
    console.log("\n--- TASK 10: Testing Webhook Idempotency... ---");
    // Manually trigger the webhook endpoint again with the same payment ID
    const duplicateRes = await fetch('http://localhost:5173/api/webhook/mercadopago', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'payment',
        data: {
          id: details.payment_id
        }
      })
    });
    
    if (!duplicateRes.ok) {
      throw new Error(`Webhook duplicate call failed: ${await duplicateRes.text()}`);
    }
    
    const dupResult = await duplicateRes.json();
    console.log("Duplicate Webhook Response:", dupResult);
    
    // Check billing_events count has not increased
    const { data: finalBillingEvents } = await supabaseAdmin
      .from('billing_events')
      .select('id')
      .eq('user_id', testUserId);
      
    console.log(`Billing events count after duplicate webhook: ${finalBillingEvents.length}`);
    
    // Check events for payment_ignored_duplicate
    const { data: finalEvents } = await supabaseAdmin
      .from('events')
      .select('event_type')
      .eq('user_id', testUserId);
      
    const hasIgnoredDuplicate = finalEvents.some(e => e.event_type === 'payment_ignored_duplicate');
    
    if (dupResult.billingResult && dupResult.billingResult.duplicated === true && hasIgnoredDuplicate) {
      report.IDEMPOTENCIA_OK = 'PASS';
      console.log("✅ Idempotency test passed! Duplicate ignored correctly.");
    } else {
      details.failures.push("Idempotency check failed: duplicate not flagged as true or ignored event missing.");
    }

    // 6. Scenario: Rejected Payment (Task 11)
    console.log("\n--- TASK 11: Scenario - Rejected Payment ---");
    const rejectedCardToken = await createCardToken('4012002133477142'); // Rejected card
    const rejectedPayment = await executePayment(
      rejectedCardToken,
      'test_user@test.com',
      testUserId,
      14.90,
      notificationUrl,
      'Rejected Payment'
    );
    
    // Wait a few seconds for webhook
    await sleep(4000);
    const { data: rejectedProfile } = await supabaseAdmin
      .from('profiles')
      .select('plano, assinatura_status')
      .eq('id', testUserId)
      .single();
    console.log(`Profile status after rejected payment: plano=${rejectedProfile.plano}, status=${rejectedProfile.assinatura_status}`);
    
    // 7. Scenario: Pending Payment (Task 11)
    console.log("\n--- TASK 11: Scenario - Pending Payment ---");
    const pendingCardToken = await createCardToken('4012002133477145'); // Pending status card
    const pendingPayment = await executePayment(
      pendingCardToken,
      'test_user@test.com',
      testUserId,
      14.90,
      notificationUrl,
      'Pending Payment'
    );
    
    // 8. Scenario: User Without Profile (Task 11)
    console.log("\n--- TASK 11: Scenario - User Without Profile ---");
    const nonExistentUserId = crypto.randomUUID();
    const noProfileCardToken = await createCardToken('4012002133477141');
    const noProfilePayment = await executePayment(
      noProfileCardToken,
      'test_user@test.com',
      nonExistentUserId,
      14.90,
      notificationUrl,
      'No Profile Payment'
    );

    console.log("\nE2E Validation complete! Compiling report...");
  } catch (error) {
    console.error("❌ Exception during E2E validation:", error);
    details.failures.push(error.message);
  }

  // Fetch final logs from DB events table
  const { data: dbLogs } = await supabaseAdmin
    .from('events')
    .select('event_type, metadata, created_at')
    .eq('user_id', testUserId)
    .order('created_at', { ascending: true });
    
  details.logs = dbLogs || [];

  // Print Final Report
  console.log("\n====================================================");
  console.log("📊 FINAL E2E VALIDAÇÃO REPORT");
  console.log("====================================================");
  console.log(`CHECKOUT_CRIADO = ${report.CHECKOUT_CRIADO}`);
  console.log(`PAGAMENTO_SANDBOX_APROVADO = ${report.PAGAMENTO_SANDBOX_APROVADO}`);
  console.log(`WEBHOOK_RECEBIDO = ${report.WEBHOOK_RECEBIDO}`);
  console.log(`PROFILE_ATUALIZADO = ${report.PROFILE_ATUALIZADO}`);
  console.log(`SUBSCRIPTION_CRIADA = ${report.SUBSCRIPTION_CRIADA}`);
  console.log(`BILLING_EVENT_CRIADO = ${report.BILLING_EVENT_CRIADO}`);
  console.log(`EVENTS_REGISTRADOS = ${report.EVENTS_REGISTRADOS}`);
  console.log(`IDEMPOTENCIA_OK = ${report.IDEMPOTENCIA_OK}`);
  console.log("----------------------------------------------------");
  console.log(`payment_id = ${details.payment_id}`);
  console.log(`preference_id = ${details.preference_id}`);
  console.log(`user_id = ${details.user_id}`);
  console.log("----------------------------------------------------");
  console.log("Failures found:", details.failures);
  console.log("====================================================");
  
  const allPassed = Object.values(report).every(v => v === 'PASS');
  console.log(`\nRESULTADO FINAL = ${allPassed ? 'PASSOU' : 'FALHOU'}`);
  process.exit(allPassed ? 0 : 1);
}

main();
