const MP_ACCESS_TOKEN = 'TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165';

async function run() {
  console.log("Creating test buyer with description...");
  const res = await fetch('https://api.mercadopago.com/users/test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      site_id: 'MLB',
      description: 'Test Buyer description'
    })
  });
  const data = await res.json();
  console.log("Response:", data);
}

run();
