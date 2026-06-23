import crypto from 'crypto';

const MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || "TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165";

async function testPix() {
  const idempotencyKey = crypto.randomUUID();
  
  const payload = {
    transaction_amount: 14.90,
    payment_method_id: 'pix',
    payer: {
      email: "test_user@test.com",
      identification: {
        type: "CPF",
        number: "19100000000" // Generic valid test CPF format
      },
      first_name: "Test",
      last_name: "User"
    },
    description: "MyFlowDay Premium Plan"
  };

  console.log("Sending payload to Mercado Pago Pix API...");
  const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });

  const status = mpResponse.status;
  const data = await mpResponse.json().catch(() => ({}));
  
  console.log(`HTTP Status: ${status}`);
  console.log("Response:", JSON.stringify(data, null, 2));
}

testPix();
