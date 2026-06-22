const testUserId = '0ba573ad-843c-4536-bfdb-e52bad2bed60';

async function run() {
  const checkoutRes = await fetch('http://localhost:5173/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: testUserId,
      email: 'tester-flowday-e2e-3@gmail.com'
    })
  });
  
  if (!checkoutRes.ok) {
    console.error("Failed:", await checkoutRes.text());
    return;
  }
  
  const prefData = await checkoutRes.json();
  console.log("INIT_POINT:", prefData.init_point);
}

run();
