import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const url = envFile.match(/VITE_SUPABASE_URL=(.+)/)[1].trim();
const key = envFile.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const supabase = createClient(url, key);

async function run() {
  console.log("Checking columns on 'profiles' table...");
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (profileError) {
    console.error("Error fetching profiles:", profileError);
  } else {
    console.log("Profiles sample row keys:", profileData.length > 0 ? Object.keys(profileData[0]) : "No rows found");
  }
}

run();
