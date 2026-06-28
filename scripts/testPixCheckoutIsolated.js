import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) process.env[k.trim()] = v.trim();
  });
}
if (!process.env.ASAAS_API_KEY) {
  process.env.ASAAS_API_KEY = '$aact_YTU5YTE0MzAzN2M0NDJjMzczNGU5ODRiNmViY2M1YjE6OjAwMDAwMDAwMDAwMDAwMDAwMDowMDAwMDAwMDAwMDA=';
}

function generateValidCpf() {
  const rnd = () => Math.floor(Math.random() * 9);
  const n = Array.from({ length: 9 }, rnd);
  let d1 = n.reduce((acc, val, idx) => acc + val * (10 - idx), 0);
  d1 = 11 - (d1 % 11); if (d1 >= 10) d1 = 0;
  let d2 = [...n, d1].reduce((acc, val, idx) => acc + val * (11 - idx), 0);
  d2 = 11 - (d2 % 11); if (d2 >= 10) d2 = 0;
  return [...n, d1, d2].join('');
}

const cleanCpf = generateValidCpf();
const uniqueEmail = `test_pix_${Date.now()}@myflowday.com.br`;
const testUserId = `00000000-0000-4000-8000-${String(Date.now()).padStart(12, '0')}`;

console.log('=== [DEBUGGER] INICIANDO TESTE REAL DE CHECKOUT PIX (DADOS ISOLADOS & LIMPOS) ===');
console.log('Timestamp Inicio:', new Date().toISOString());
console.log('User ID Alvo:', testUserId);
console.log('Email Alvo:', uniqueEmail);
console.log('CPF Válido Gerado:', cleanCpf);

async function runTest() {
  const { default: handler } = await import('../api/[...routes].js');
  
  const payload = {
    billingType: 'PIX',
    userId: testUserId,
    email: uniqueEmail,
    cpf: cleanCpf,
    firstName: 'Irmã Teste',
    lastName: 'Prod'
  };

  console.log('\n[STAGE 1] Request Payload enviado ao Handler (Serializado):');
  console.log(JSON.stringify(payload, null, 2));

  const req = {
    method: 'POST',
    headers: { 'user-agent': 'DiagnosticScript/1.0' },
    query: { routes: ['subscription', 'create'] },
    body: payload
  };

  const res = {
    setHeader: () => {},
    status: (code) => ({
      json: (data) => {
        console.log('\n[STAGE 2] Resposta da API /api/subscription/create:');
        console.log('HTTP Status Code:', code);
        console.log('Response Body Raw:');
        console.log(JSON.stringify(data, null, 2));
        console.log('\nTimestamp Fim:', new Date().toISOString());
        process.exit(0);
      }
    })
  };

  await handler(req, res);
}

runTest();
