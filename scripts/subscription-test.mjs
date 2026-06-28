/**
 * subscription:test — Script de testes automatizados para o fluxo de assinaturas
 * MyFlowDay Premium (Asaas Engine)
 *
 * Uso:
 *   npm run subscription:test
 *   BASE_URL=https://myflowday.com.br npm run subscription:test
 *
 * Requer:
 *   - .env.local com SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - Servidor local rodando (npm run dev) ou BASE_URL de staging
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// ─── Helpers ───────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

let passed = 0;
let failed = 0;
const results = [];

function assert(label, condition, detail = '') {
    if (condition) {
        console.log(`  ✅ ${label}`);
        results.push({ label, ok: true });
        passed++;
    } else {
        console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
        results.push({ label, ok: false, detail });
        failed++;
    }
}

async function apiGet(path) {
    const r = await fetch(`${BASE_URL}/api/${path}`);
    return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function apiPost(path, data) {
    const r = await fetch(`${BASE_URL}/api/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
}

// ─── Suite 1: Health Check ──────────────────────────────────────────────────

async function testHealthCheck() {
    console.log('\n📡 Suite 1: Health Check');
    const { status, body } = await apiGet('health');
    assert('GET /api/health retorna 200', status === 200);
    assert('Resposta contém status: online', body.status === 'online');
}

// ─── Suite 2: Subscription Create — Validações de Entrada ──────────────────

async function testSubscriptionValidations() {
    console.log('\n🛡️  Suite 2: Validações de entrada — /api/subscription/create');

    // Sem userId
    let r = await apiPost('subscription/create', {});
    assert('Sem userId → 400', r.status === 400);
    assert('Mensagem: userId obrigatório', r.body.error?.includes('userId'));

    // Sem card_token_id
    r = await apiPost('subscription/create', { userId: 'test-user', email: 'test@test.com', cpf: '12345678901' });
    assert('Sem card_token_id → 400', r.status === 400);
    assert('Mensagem: card_token_id obrigatório', r.body.error?.includes('card_token_id'));

    // CPF inválido (menos de 11 dígitos)
    r = await apiPost('subscription/create', {
        userId: 'test-user',
        card_token_id: 'fake-token',
        email: 'test@test.com',
        cpf: '123'
    });
    assert('CPF inválido → 400', r.status === 400);
    assert('Mensagem: CPF inválido', r.body.error?.includes('CPF'));
}

// ─── Suite 3: Subscription Status ──────────────────────────────────────────

async function testSubscriptionStatus() {
    console.log('\n📊 Suite 3: GET /api/subscription/status');

    // Sem userId
    let r = await apiGet('subscription/status');
    assert('Sem userId → 400', r.status === 400);

    // userId inexistente → sem assinatura
    r = await apiGet('subscription/status?userId=00000000-0000-0000-0000-000000000000');
    assert('userId inexistente → 200 com isPremium=false', r.status === 200 && r.body.isPremium === false);
    assert('reason: sem_assinatura', r.body.reason === 'sem_assinatura');
}

// ─── Suite 4: checkPremiumAccess — Supabase direto ─────────────────────────

async function testCheckPremiumAccessDirectly() {
    console.log('\n🔒 Suite 4: checkPremiumAccess — via Supabase direto');

    const testUserId = `test-access-${Date.now()}`;

    // Cria registro authorized
    await supabase.from('subscriptions').upsert({
        user_id: testUserId,
        asaas_subscription_id: `test_sub_${Date.now()}`,
        status: 'active',
        plan: 'premium',
        amount: 14.90,
        provider: 'asaas',
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' }).catch(() => {});

    const r1 = await apiGet(`subscription/status?userId=${testUserId}`);
    assert('Status authorized → isPremium: true', r1.body.isPremium === true, JSON.stringify(r1.body));

    // Atualiza para paused
    await supabase.from('subscriptions').update({ status: 'paused' }).eq('user_id', testUserId);
    const r2 = await apiGet(`subscription/status?userId=${testUserId}`);
    assert('Status paused → isPremium: false', r2.body.isPremium === false, JSON.stringify(r2.body));
    assert('reason contém paused', r2.body.reason?.includes('paused'), r2.body.reason);

    // Atualiza para cancelled
    await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('user_id', testUserId);
    const r3 = await apiGet(`subscription/status?userId=${testUserId}`);
    assert('Status cancelled → isPremium: false', r3.body.isPremium === false);

    // Atualiza para expired
    await supabase.from('subscriptions').update({ status: 'expired' }).eq('user_id', testUserId);
    const r4 = await apiGet(`subscription/status?userId=${testUserId}`);
    assert('Status expired → isPremium: false', r4.body.isPremium === false);

    // Limpa registro de teste
    await supabase.from('subscriptions').delete().eq('user_id', testUserId).catch(() => {});
}

// ─── Suite 5: Webhook — Evento desconhecido ────────────────────────────────

async function testWebhookUnknownEvent() {
    console.log('\n🔔 Suite 5: Webhook — evento desconhecido logado');

    const r = await apiPost('webhooks/asaas', {
        event: 'UNKNOWN_EVENT_TYPE',
        payment: { id: 'test-123' }
    });

    // Deve aceitar (200) mas não processar
    assert('Evento desconhecido → 200', r.status === 200);
    assert('Mensagem indica não processado', r.body.message?.includes('não processado') || r.body.success !== true);
}

// ─── Suite 6: Idempotência — subscription/create ───────────────────────────

async function testIdempotency() {
    console.log('\n🔁 Suite 6: Idempotência — assinatura já existe');

    const testUserId = `test-idempotency-${Date.now()}`;

    // Cria registro authorized manualmente
    const testSubId = `sub_idempotency_${Date.now()}`;
    await supabase.from('subscriptions').upsert({
        user_id: testUserId,
        asaas_subscription_id: testSubId,
        status: 'active',
        plan: 'premium',
        amount: 14.90,
        provider: 'asaas',
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' }).catch(() => {});

    const r = await apiPost('subscription/create', {
        userId: testUserId,
        email: 'test@test.com',
        cpf: '52998224725',
        firstName: 'João',
        lastName: 'Silva'
    });

    assert('Assinatura existente → retorna alreadyExists:true', r.body.alreadyExists === true, JSON.stringify(r.body));
    assert('Retorna asaas_subscription_id existente', r.body.asaas_subscription_id === testSubId);

    // Limpa
    await supabase.from('subscriptions').delete().eq('user_id', testUserId).catch(() => {});
}

// ─── Suite 7: subscription_logs — Insert direto ────────────────────────────

async function testSubscriptionLogs() {
    console.log('\n📋 Suite 7: subscription_logs — tabela acessível');

    const testSubId = `test_log_${Date.now()}`;
    const { error } = await supabase.from('subscription_logs').insert([{
        subscription_id: testSubId,
        event_type: 'test.suite.automated',
        payload: { test: true, ts: new Date().toISOString() },
        created_at: new Date().toISOString()
    }]);

    assert('Insert em subscription_logs bem-sucedido', !error, error?.message);

    // Verifica que foi salvo
    const { data } = await supabase
        .from('subscription_logs')
        .select('id, event_type')
        .eq('subscription_id', testSubId)
        .maybeSingle();

    assert('Log recuperado do banco', !!data, 'row not found');
    assert('event_type correto', data?.event_type === 'test.suite.automated');

    // Limpa
    await supabase.from('subscription_logs').delete().eq('subscription_id', testSubId).catch(() => {});
}

// ─── Runner ────────────────────────────────────────────────────────────────

async function run() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   MyFlowDay — Subscription Test Suite                   ║');
    console.log('║   Base URL:', BASE_URL.padEnd(44), '║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('\n❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.');
        console.error('   Configure no arquivo .env.local e tente novamente.\n');
        process.exit(1);
    }

    try {
        await testHealthCheck();
        await testSubscriptionValidations();
        await testSubscriptionStatus();
        await testCheckPremiumAccessDirectly();
        await testWebhookUnknownEvent();
        await testIdempotency();
        await testSubscriptionLogs();
    } catch (err) {
        console.error('\n💥 Erro fatal durante os testes:', err.message);
        failed++;
    }

    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`Resultado: ${passed} passaram | ${failed} falharam`);
    console.log('══════════════════════════════════════════════════════════\n');

    if (failed > 0) {
        console.log('❌ FALHAS:');
        results.filter(r => !r.ok).forEach(r => console.log(`   - ${r.label}${r.detail ? ': ' + r.detail : ''}`));
        console.log('');
        process.exit(1);
    } else {
        console.log('✅ Todos os testes passaram. Pronto para homologação.\n');
        process.exit(0);
    }
}

run();
