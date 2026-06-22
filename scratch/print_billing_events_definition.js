import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const url = process.env.SUPABASE_URL || "https://mftsklhrzhhvtsuamqaw.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    const billingEventsDef = data.definitions.billing_events;
    console.log("billing_events definition in OpenAPI:");
    console.log(JSON.stringify(billingEventsDef, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
