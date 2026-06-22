import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.SUPABASE_URL || "https://mftsklhrzhhvtsuamqaw.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log(`Fetching OpenAPI spec from: ${url}/rest/v1/`);
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
    console.log("Exposed Tables/Paths:");
    console.log(Object.keys(data.paths).filter(p => p !== "/"));
    
    console.log("\nDefinitions (Schemas):");
    console.log(Object.keys(data.definitions || {}));
  } catch (err) {
    console.error("Error fetching OpenAPI spec:", err.message);
  }
}

run();
