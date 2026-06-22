const MP_ACCESS_TOKEN = 'TEST-5944910093081420-062100-95d82fd469dc4b7a4f53d7bd44d33269-2394045165';

async function run() {
  console.log("Listing test users...");
  const res = await fetch('https://api.mercadopago.com/users/test', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
    }
  });
  const data = await res.json();
  console.log("Test users list:", JSON.stringify(data, null, 2));
}

run();
