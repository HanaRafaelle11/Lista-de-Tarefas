const MERCADOPAGO_ACCESS_TOKEN = "TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165";

async function main() {
  const response = await fetch('https://api.mercadopago.com/users/test_user', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      site_id: 'MLB'
    })
  });

  if (!response.ok) {
    console.error("Failed to create test user:", await response.text());
    return;
  }

  const data = await response.json();
  console.log("Test User Data:", JSON.stringify(data, null, 2));
}

main();
