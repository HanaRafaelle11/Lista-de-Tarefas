import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Listing auth users...");
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("❌ Error listing users:", error.message);
  } else {
    console.log(`✅ Success! Found ${users.length} users in auth.`);
    const simulated = users.filter(u => u.email?.endsWith("@fakeflowday.com"));
    console.log(`Simulated users count: ${simulated.length}`);
    if (simulated.length > 0) {
      console.log("Sample simulated user email:", simulated[0].email);
    }
  }
}

run();
