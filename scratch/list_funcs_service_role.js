import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Querying pg_proc for user-defined functions...");
  // Let's query pg_proc joining pg_namespace to filter by schema 'public'
  const { data, error } = await supabase
    .from("pg_proc")
    .select("proname, pg_namespace!inner(nspname)")
    .eq("pg_namespace.nspname", "public");

  if (error) {
    console.error("❌ Error querying pg_proc:", error.message);
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log("✅ Successfully retrieved functions in public schema:");
    console.log(data);
  }
}

run();
