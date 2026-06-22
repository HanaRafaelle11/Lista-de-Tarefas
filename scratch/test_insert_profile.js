import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { randomUUID } from "crypto";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const userId = randomUUID();
  console.log("Testing insert into profiles with random UUID:", userId);
  
  const { data, error } = await supabase.from("profiles").insert({
    id: userId,
    name: "Test Random UUID",
    plano: "free",
    assinatura_status: "active",
    updated_at: new Date().toISOString()
  }).select();
  
  if (error) {
    console.error("❌ Insert failed:", error.message);
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log("✅ Insert succeeded! Data:", data);
    // Cleanup if succeeded
    await supabase.from("profiles").delete().eq("id", userId);
  }
}

run();
