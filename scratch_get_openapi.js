import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function run() {
  console.log('Fetching OpenAPI spec from PostgREST using service_role key...');
  const res = await fetch(url + '/rest/v1/', {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });

  if (!res.ok) {
    console.error('Failed to fetch:', res.status, await res.text());
    return;
  }

  const spec = await res.json();
  console.log('OpenAPI Version:', spec.openapi);
  console.log('Exposed Paths (Tables/RPCs):', Object.keys(spec.paths).filter(p => p.startsWith('/rpc/')));
}

run();
