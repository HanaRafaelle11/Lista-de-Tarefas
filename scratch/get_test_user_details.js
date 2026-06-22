const MP_ACCESS_TOKEN = 'TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165';

async function run() {
  const userId = '3489261588';
  console.log(`Fetching user details for ID: ${userId}...`);
  const res = await fetch(`https://api.mercadopago.com/users/${userId}`, {
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
    }
  });
  const data = await res.json();
  console.log("Response:", data);
}

run();
