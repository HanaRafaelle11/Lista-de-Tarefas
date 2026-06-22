import fs from 'fs';
import path from 'path';

const MERCADOPAGO_ACCESS_TOKEN = "TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165";
const paymentId = '1327500300';

async function main() {
  const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!mpResponse.ok) {
    console.error("Failed to query payment:", await mpResponse.text());
    return;
  }

  const paymentDetails = await mpResponse.json();
  console.log("Payment Details:", JSON.stringify(paymentDetails, null, 2));
}

main();
