import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const rpcNames = ["exec_sql", "execute_sql", "run_sql", "exec", "exec_sql_query"];

for (const name of rpcNames) {
  try {
    console.log(`Testing RPC: ${name}...`);
    const { data, error } = await supabase.rpc(name, { sql: "SELECT 1 as val;" });
    if (!error) {
      console.log(`✅ Found working RPC: ${name}! Data:`, data);
      break;
    } else {
      console.log(`❌ RPC ${name} failed:`, error.message);
    }
  } catch (err) {
    console.log(`💥 RPC ${name} exception:`, err.message);
  }
}
