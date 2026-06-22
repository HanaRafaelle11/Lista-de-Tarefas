import crypto from 'crypto';

const MP_PUBLIC_KEY = 'TEST-335ed727-9096-42ae-948f-fbff929c3571';
const MP_ACCESS_TOKEN = 'TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165';

async function createCardToken() {
  const res = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${MP_PUBLIC_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card_number: '5031433215406351',
      expiration_month: 11,
      expiration_year: 2030,
      security_code: '123',
      cardholder: {
        name: 'APRO',
        identification: { type: 'CPF', number: '12345678909' }
      }
    })
  });
  if (!res.ok) throw new Error(`Token failed: ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

async function run() {
  try {
    const token = await createCardToken();
    console.log(`Card Token: ${token}`);
    
    const idempotencyKey = crypto.randomUUID();
    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        transaction_amount: 14.90,
        token: token,
        description: `MyFlowDay E2E Real test`,
        installments: 1,
        payment_method_id: 'master',
        payer: { email: 'test_user@test.com' }
      })
    });
    
    const payment = await res.json();
    console.log("Payment response status:", payment.status, "detail:", payment.status_detail);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
