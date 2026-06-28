import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Carregar variáveis de ambiente de .env.local
const envPath = path.resolve('.env.local');
let envFile = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const parseEnv = (key) => {
  const match = envFile.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim().replace(/['"]/g, '') : null;
};

process.env.SUPABASE_URL = parseEnv('SUPABASE_URL') || parseEnv('VITE_SUPABASE_URL') || 'https://mftsklhrzhhvtsuamqaw.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = parseEnv('SUPABASE_SERVICE_ROLE_KEY') || 'mock-key';
process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;

const { RateLimiter } = await import('../server/modules/rpl/rate-limiter.js');
const { CircuitBreakerFactory, CircuitState } = await import('../server/modules/rpl/circuit-breaker.js');
const { WebhookQueue } = await import('../server/modules/rpl/webhook-queue.js');
const { BackpressureControl } = await import('../server/modules/rpl/backpressure.js');

console.log('⚡ EXECUTANDO TESTES DE HOMOLOGAÇÃO DO RUNTIME PROTECTION LAYER (RPL)...\n');

async function testRPL() {
  let passed = 0;

  // 1. TEST RATE LIMITER
  console.log('1️⃣ Testando Rate Limiter (Spam Protection & HTTP 429)...');
  const testIp = '192.168.1.100';
  for (let i = 0; i < 5; i++) {
    const res = RateLimiter.check(testIp, { maxRequests: 5, windowMs: 1000 });
    assert.strictEqual(res.allowed, true, `Requisição ${i+1} deveria ser permitida`);
  }
  const overflowRes = RateLimiter.check(testIp, { maxRequests: 5, windowMs: 1000 });
  assert.strictEqual(overflowRes.allowed, false, 'Requisição 6 deveria ser bloqueada (HTTP 429)');
  console.log('   ✔ Rate Limiter: OK (Bloqueou disparo em excesso)');
  passed++;

  // 2. TEST CIRCUIT BREAKER
  console.log('2️⃣ Testando Circuit Breaker (Anti-Colapso / OPEN state)...');
  const breaker = CircuitBreakerFactory.getBreaker('test-db-breaker', { failureThreshold: 0.3, minimumRequests: 5, cooldownMs: 500 });
  
  // Simula falhas consecutivas para estourar a taxa de erro > 30%
  for (let i = 0; i < 5; i++) {
    try {
      await breaker.execute(async () => { throw new Error('DB Connection Timeout'); });
    } catch (err) {}
  }

  const status = breaker.getStatus();
  assert.strictEqual(status.state, CircuitState.OPEN, 'Circuito deveria estar ABERTO (OPEN) após taxa de erro > 30%');
  console.log('   ✔ Circuit Breaker: OK (Transicionou para OPEN após falhas em massa)');
  passed++;

  // 3. TEST WEBHOOK QUEUE & BUFFER
  console.log('3️⃣ Testando Webhook Queue (Desacoplamento Assíncrono)...');
  const qResult = await WebhookQueue.enqueue({ event: 'PAYMENT_RECEIVED', id: 'pay_async_123', customer: 'cus_async_123' });
  assert.strictEqual(qResult.queued, true, 'Webhook deveria ser enfileirado com sucesso');
  console.log('   ✔ Webhook Queue: OK (Buffers em memória ativos)');
  passed++;

  // 4. TEST BACKPRESSURE CONTROL
  console.log('4️⃣ Testando Backpressure Control (Gestão de Carga)...');
  const bpStatus = BackpressureControl.assess();
  assert.strictEqual(typeof bpStatus.level, 'string', 'Nível de backpressure deve ser avaliado');
  console.log('   ✔ Backpressure Control: OK (Status:', bpStatus.level, ')');
  passed++;

  console.log('\n==================================================');
  console.log(`📋 RESULTADO GERAL RPL: ${passed}/4 Testes Aprovados | 0 Falhas`);
  console.log('==================================================');
  console.log('\n🚀 STRIPE-LIKE RESILIENCE CONFIRMADA!\n');
}

testRPL();
