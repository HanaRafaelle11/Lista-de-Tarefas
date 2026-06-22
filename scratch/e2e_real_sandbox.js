import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const serviceKeyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseAdmin = createClient(urlMatch[1].trim(), serviceKeyMatch[1].trim());

const mpTokenMatch = envFile.match(/MERCADOPAGO_ACCESS_TOKEN=(.+)/);
const mpToken = (mpTokenMatch ? mpTokenMatch[1].trim() : "TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165").replace(/['";]/g, '');

const testUserId = '0ba573ad-843c-4536-bfdb-e52bad2bed60';

function findTunnelUrl() {
  const projectTunnelFile = path.resolve('.tunnel_url');
  if (fs.existsSync(projectTunnelFile)) {
    const url = fs.readFileSync(projectTunnelFile, 'utf8').trim();
    if (url) return url;
  }
  const tasksDir = 'C:\\Users\\rafox\\.gemini\\antigravity-ide\\brain\\a9c6963d-b94a-4e50-ae4f-1c85e1fc3d5d\\.system_generated\\tasks';
  if (!fs.existsSync(tasksDir)) {
    console.log("Tasks directory not found.");
    return null;
  }
  const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.log'));
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(tasksDir, file), 'utf8');
      const match = content.match(/your url is:\s*(https:\/\/[^\s]+)/);
      if (match) {
        return match[1].trim();
      }
    } catch (e) {
      // Ignore reading errors
    }
  }
  return null;
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("====================================================");
  console.log("🏁 INICIANDO TESTE E2E REAL MERCADO PAGO SANDBOX");
  console.log("====================================================");

  let report = {
    CHECKOUT: { created: 'FAIL' },
    WEBHOOK: { received: 'FAIL', latency_ms: 0 },
    MERCADO_PAGO: { payment_status: 'pending' },
    DATABASE: {
      profiles_update: 'FAIL',
      subscriptions_update: 'FAIL',
      billing_events: 'FAIL',
      events: 'FAIL'
    },
    IDEMPOTENCY: { duplicate_prevented: 'FAIL' },
    INFRA: { webhook_public_url: 'FAIL', dev_server: 'FAIL' }
  };

  // 1. Verificar ambiente
  console.log("\n--- PASSO 1: Verificando Ambiente ---");
  
  // Check Dev Server
  try {
    const devRes = await fetch('http://localhost:5173/');
    if (devRes.ok) {
      console.log("✅ Dev Server is running on port 5173.");
      report.INFRA.dev_server = 'OK';
    } else {
      console.log(`❌ Dev Server responded with status: ${devRes.status}`);
    }
  } catch (err) {
    console.error("❌ Dev Server is NOT running or unreachable on port 5173:", err.message);
    report.INFRA.dev_server = 'FAIL';
  }

  // Check Supabase
  try {
    const { data, error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (error) throw error;
    console.log("✅ Supabase is accessible.");
  } catch (err) {
    console.error("❌ Supabase check failed:", err.message);
    console.log("Finalizing E2E validation script: FAILURE.");
    process.exit(1);
  }

  // Find public tunnel
  const publicUrl = findTunnelUrl();
  if (publicUrl) {
    console.log(`✅ Webhook public tunnel URL found: ${publicUrl}`);
    report.INFRA.webhook_public_url = 'OK';
  } else {
    console.error("❌ Webhook public URL not found. Make sure localtunnel task is active.");
    report.INFRA.webhook_public_url = 'FAIL';
    process.exit(1);
  }

  // Prepare profile row
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
  await cleanDatabaseState(testUserId);

  // 2. Criar Preferência de Checkout Real
  console.log("\n--- PASSO 2: Criando Comprador de Teste Sandbox ---");
  let buyerEmail = 'test_user_17293570220092106@testuser.com';
  try {
    const userRes = await fetch('https://api.mercadopago.com/users/test_user', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ site_id: 'MLB' })
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      buyerEmail = userData.email;
      console.log(`✅ Novo Comprador de Teste Sandbox criado: ${buyerEmail}`);
    } else {
      console.warn("⚠️ Falha ao criar comprador de teste via API. Usando e-mail de fallback:", buyerEmail);
    }
  } catch (err) {
    console.warn("⚠️ Erro ao criar comprador de teste via API. Usando e-mail de fallback:", err.message);
  }

  console.log("\n--- PASSO 2b: Criando Preferência Checkout Pro ---");
  const notificationUrl = `${publicUrl}/api/webhook/mercadopago`;
  console.log(`Notification Webhook URL: ${notificationUrl}`);
  
  let prefData;
  try {
    const checkoutRes = await fetch('http://localhost:5173/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        email: buyerEmail,
        notificationUrl: notificationUrl
      })
    });
    if (!checkoutRes.ok) throw new Error(`Preference creation failed: ${await checkoutRes.text()}`);
    prefData = await checkoutRes.json();
    console.log("✅ Checkout preference created successfully:", prefData);
    report.CHECKOUT.created = 'PASS';
  } catch (err) {
    console.error("❌ Preference creation failed:", err.message);
    process.exit(1);
  }

  // 3. Instruções ao Usuário
  console.log("\n====================================================");
  console.log("👉 AÇÃO REQUERIDA DO USUÁRIO");
  console.log("====================================================");
  console.log("Abra o link abaixo no seu navegador (de preferência aba anônima):");
  console.log(`\n🔗 LINK DO CHECKOUT: ${prefData.init_point}\n`);
  console.log("No checkout, preencha os seguintes dados de cartão de teste:");
  console.log("- Bandeira: Mastercard");
  console.log("- Número: 5031 4332 1540 6351");
  console.log("- Código de Segurança (CVV): 123");
  console.log("- Validade: 11/30");
  console.log("- Nome: APRO");
  console.log(`- Documento (CPF): 12345678909`);
  console.log(`- E-mail do comprador: ${buyerEmail}`);
  console.log("====================================================");
  console.log("Aguardando confirmação de pagamento via Webhook (Timeout de 15 minutos)...");

  // 4. Polling Supabase for Approved Webhook Execution
  const startTime = Date.now();
  let paymentId = null;
  let webhookReceived = false;

  // Poll for up to 15 minutes (90 attempts of 10s)
  for (let attempt = 1; attempt <= 90; attempt++) {
    const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
    const elapsedSeconds = Math.floor(((Date.now() - startTime) % 60000) / 1000);
    console.log(`[Tempo decorrido: ${elapsedMinutes}m ${elapsedSeconds}s] Monitorando banco de dados (tentativa ${attempt}/90)...`);
    
    // Check billing_events table
    const { data: billingEvents } = await supabaseAdmin
      .from('billing_events')
      .select('*')
      .eq('user_id', testUserId);
      
    const approvedEvent = billingEvents?.find(e => e.status === 'approved');
    if (approvedEvent) {
      paymentId = approvedEvent.metadata?.payment_id;
      webhookReceived = true;
      report.WEBHOOK.received = 'PASS';
      report.WEBHOOK.latency_ms = Date.now() - startTime;
      console.log(`\n✅ WEBHOOK DETECTADO! Payment ID: ${paymentId}`);
      break;
    }
    
    await sleep(10000);
  }

  if (!webhookReceived) {
    console.error("❌ Timeout: Nenhuma transação aprovada foi registrada no banco.");
    report.FINAL_RESULT = 'FALHOU';
    printReport(report, paymentId, prefData.preferenceId);
    process.exit(1);
  }

  // 5. Validar Banco
  console.log("\n--- PASSO 3: Validando Atualizações no Supabase ---");
  
  // Profiles Check
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plano, assinatura_status')
    .eq('id', testUserId)
    .single();
    
  if (profile && profile.plano === 'premium' && profile.assinatura_status === 'active') {
    console.log("✅ Table profiles: UPDATED correctly (plano=premium, status=active).");
    report.DATABASE.profiles_update = 'PASS';
  } else {
    console.error("❌ Table profiles: NOT updated correctly:", profile);
  }

  // Subscriptions Check
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('status, plan')
    .eq('user_id', testUserId)
    .maybeSingle();
    
  if (sub && sub.status === 'active' && sub.plan === 'premium') {
    console.log("✅ Table subscriptions: CREATED correctly (status=active, plan=premium).");
    report.DATABASE.subscriptions_update = 'PASS';
  } else {
    console.error("❌ Table subscriptions: NOT created correctly:", sub);
  }

  // Billing Events Check
  console.log("✅ Table billing_events: RECORDED correctly.");
  report.DATABASE.billing_events = 'PASS';

  // Events Check
  const { data: events } = await supabaseAdmin
    .from('events')
    .select('event_type')
    .eq('user_id', testUserId);
    
  const hasPaymentApproved = events?.some(e => e.event_type === 'payment_approved');
  const hasUserUpgraded = events?.some(e => e.event_type === 'user_upgraded');
  
  if (hasPaymentApproved && hasUserUpgraded) {
    console.log("✅ Table events: LOGGED analytics correctly.");
    report.DATABASE.events = 'PASS';
  } else {
    console.error("❌ Table events: Missing analytical events.", events);
  }

  // 6. Teste de Idempotência
  console.log("\n--- PASSO 4: Testando Idempotência ---");
  const duplicateRes = await fetch('http://localhost:5173/api/webhook/mercadopago', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'payment',
      data: {
        id: paymentId
      }
    })
  });
  
  if (duplicateRes.ok) {
    const dupResult = await duplicateRes.json();
    console.log("Duplicate response:", dupResult);
    
    // Check final count of billing events
    const { data: billingEventsAfter } = await supabaseAdmin
      .from('billing_events')
      .select('id')
      .eq('user_id', testUserId);
      
    // Check events for payment_ignored_duplicate
    const { data: eventsAfter } = await supabaseAdmin
      .from('events')
      .select('event_type')
      .eq('user_id', testUserId);
      
    const hasIgnored = eventsAfter?.some(e => e.event_type === 'payment_ignored_duplicate');
    
    if (dupResult.billingResult?.duplicated === true && hasIgnored && billingEventsAfter.length === 1) {
      console.log("✅ Idempotency check: SUCCESS. Duplicate ignored, event logged.");
      report.IDEMPOTENCY.duplicate_prevented = 'PASS';
    } else {
      console.error("❌ Idempotency check: FAILED.");
    }
  } else {
    console.error("❌ Idempotency request failed:", duplicateRes.status);
  }

  // Final status report
  report.MERCADO_PAGO.payment_status = 'approved';
  
  const allPassed = 
    report.CHECKOUT.created === 'PASS' &&
    report.WEBHOOK.received === 'PASS' &&
    report.DATABASE.profiles_update === 'PASS' &&
    report.DATABASE.subscriptions_update === 'PASS' &&
    report.DATABASE.billing_events === 'PASS' &&
    report.DATABASE.events === 'PASS' &&
    report.IDEMPOTENCY.duplicate_prevented === 'PASS';
    
  report.FINAL_RESULT = allPassed ? 'PASSOU' : 'FALHOU';

  printReport(report, paymentId, prefData.preferenceId);
  process.exit(allPassed ? 0 : 1);
}

function printReport(report, paymentId, preferenceId) {
  console.log("\n====================================================");
  console.log("📊 RELATÓRIO FINAL DO FLUXO REAL MERCADO PAGO SANDBOX");
  console.log("====================================================");
  console.log(`CHECKOUT:`);
  console.log(`- created: ${report.CHECKOUT.created}`);
  console.log(`\nWEBHOOK:`);
  console.log(`- received: ${report.WEBHOOK.received}`);
  console.log(`- latency_ms: ${report.WEBHOOK.latency_ms}`);
  console.log(`\nMERCADO PAGO:`);
  console.log(`- payment_status: ${report.MERCADO_PAGO.payment_status}`);
  console.log(`\nDATABASE:`);
  console.log(`- profiles_update: ${report.DATABASE.profiles_update}`);
  console.log(`- subscriptions_update: ${report.DATABASE.subscriptions_update}`);
  console.log(`- billing_events: ${report.DATABASE.billing_events}`);
  console.log(`- events: ${report.DATABASE.events}`);
  console.log(`\nIDEMPOTENCY:`);
  console.log(`- duplicate_prevented: ${report.IDEMPOTENCY.duplicate_prevented}`);
  console.log(`\nINFRA:`);
  console.log(`- webhook_public_url: ${report.INFRA.webhook_public_url}`);
  console.log(`- dev_server: ${report.INFRA.dev_server}`);
  console.log(`\nFINAL RESULT:`);
  console.log(`- ${report.FINAL_RESULT}`);
  console.log("----------------------------------------------------");
  console.log(`payment_id = ${paymentId}`);
  console.log(`preference_id = ${preferenceId}`);
  console.log("====================================================");
}

main();
