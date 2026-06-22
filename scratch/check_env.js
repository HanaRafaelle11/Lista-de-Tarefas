import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Carregar variáveis do .env.local
const envPath = path.resolve(".env.local");
console.log(`Checking file: ${envPath}`);
const exists = fs.existsSync(envPath);
console.log(`File .env.local exists: ${exists}`);

if (exists) {
  const content = fs.readFileSync(envPath, "utf-8");
  console.log(`File .env.local size: ${content.length} bytes`);
  
  dotenv.config({ path: envPath });
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log(`SUPABASE_URL exists: ${!!url} (length: ${url ? url.length : 0})`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY exists: ${!!key} (length: ${key ? key.length : 0})`);
  
  if (url && key) {
    try {
      const supabase = createClient(url, key);
      console.log("Testing supabase connection with select on 'profiles'...");
      const { data, error } = await supabase.from("profiles").select("*").limit(1);
      if (error) {
        console.error("❌ Supabase select error:", error.message);
        console.error(JSON.stringify(error, null, 2));
      } else {
        console.log("✅ Supabase connection successful! Retrieved data:", data);
        if (data.length > 0) {
          console.log("Sample profile schema keys:", Object.keys(data[0]));
        } else {
          console.log("No profiles found. Table is empty.");
        }
      }
      
      console.log("Testing supabase connection with select on 'billing_events'...");
      const { data: billData, error: billError } = await supabase.from("billing_events").select("*").limit(1);
      if (billError) {
        console.error("❌ Supabase billing_events select error:", billError.message);
      } else {
        console.log("✅ Supabase billing_events connection successful!");
        if (billData.length > 0) {
          console.log("Sample billing_event schema keys:", Object.keys(billData[0]));
        } else {
          console.log("No billing events found. Table is empty.");
        }
      }
    } catch (err) {
      console.error("💥 Exception while testing connection:", err);
    }
  } else {
    console.error("❌ Missing environment variables!");
  }
} else {
  console.error("❌ .env.local not found!");
}
