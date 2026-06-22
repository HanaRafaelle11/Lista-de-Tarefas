const MP_PUBLIC_KEY = 'TEST-335ed727-9096-42ae-948f-fbff929c3571';

async function run() {
  const res = await fetch(`https://api.mercadopago.com/v1/payment_methods?public_key=${MP_PUBLIC_KEY}`);
  const methods = await res.json();
  
  console.log("Credit card payment methods:");
  methods.filter(m => m.payment_type_id === 'credit_card').forEach(m => {
    console.log(`- ID: ${m.id}, Name: ${m.name}`);
    if (m.settings) {
      const bins = m.settings.map(s => s.bin ? s.bin.pattern : null).filter(Boolean);
      console.log(`  BINs: ${bins.join(', ')}`);
    }
  });
}

run();
