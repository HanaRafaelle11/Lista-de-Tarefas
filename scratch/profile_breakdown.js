import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Fetching profiles breakdown...");
  const { data, error } = await supabase.from("profiles").select("id, plano, assinatura_status");
  if (error) {
    console.error("❌ Error fetching profiles:", error.message);
    return;
  }
  
  const planCounts = {};
  const statusCounts = {};
  
  data.forEach(p => {
    planCounts[p.plano] = (planCounts[p.plano] || 0) + 1;
    statusCounts[p.assinatura_status] = (statusCounts[p.assinatura_status] || 0) + 1;
  });
  
  console.log("\nPlan counts:");
  console.log(planCounts);
  
  console.log("\nSubscription status counts:");
  console.log(statusCounts);
  
  console.log(`\nTotal profiles: ${data.length}`);
}

run();
