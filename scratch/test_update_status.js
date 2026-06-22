import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Let's get any existing profile ID
  const { data: profiles } = await supabase.from("profiles").select("id, assinatura_status").limit(1);
  if (!profiles || profiles.length === 0) {
    console.log("No profiles found.");
    return;
  }
  
  const userId = profiles[0].id;
  const originalStatus = profiles[0].assinatura_status;
  
  console.log(`Attempting to update profile ${userId} to assinatura_status: 'random_word_test'...`);
  const { data, error } = await supabase
    .from("profiles")
    .update({ assinatura_status: "random_word_test" })
    .eq("id", userId)
    .select();
    
  if (error) {
    console.error("❌ Update failed:", error.message);
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log("✅ Update succeeded! Succeeded to write lowercase 'active'. Data:", data);
    // Restore
    await supabase.from("profiles").update({ assinatura_status: originalStatus }).eq("id", userId);
  }
}

run();
