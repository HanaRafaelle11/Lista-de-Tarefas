import crypto from 'crypto';

const MP_PUBLIC_KEY = 'TEST-335ed727-9096-42ae-948f-fbff929c3571';
const MP_ACCESS_TOKEN = 'TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165';

async function createCardToken(cardNumber, cardholderName) {
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
        name: cardholderName,
        identification: {
          type: 'CPF',
          number: '12345678909'
        }
      }
    })
  });
  const cardToken = await res.json();
  return cardToken.id;
}

async function testPayment(email, cardholderName, cardNumber) {
  const token = await createCardToken(cardNumber, cardholderName);
  const idempotencyKey = crypto.randomUUID();
  console.log(`Testing payment with email: "${email}", cardholder: "${cardholderName}"...`);
  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({
      transaction_amount: 14.90,
      token,
      description: 'Test email payment',
      installments: 1,
      payment_method_id: 'visa',
      payer: {
        email
      }
    })
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`✅ Success! ID: ${data.id}, Status: ${data.status}, Detail: ${data.status_detail}`);
  } else {
    console.log(`❌ Failed:`, data);
  }
}

async function run() {
  await testPayment('test@testuser.com', 'APRO', '4235647728025682');
}

run();
