import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('[Supabase Admin] ❌ SUPABASE_URL não configurada no ambiente.');
}

if (!supabaseServiceKey) {
  // SEM a service role key, o cliente age como ANON — RLS bloqueia inserts/updates
  console.error('[Supabase Admin] ❌ CRÍTICO: SUPABASE_SERVICE_ROLE_KEY não encontrada! O cliente vai usar permissões anônimas e FALHAR em tabelas com RLS. Configure a variável no Vercel: Settings → Environment Variables → SUPABASE_SERVICE_ROLE_KEY');
}

// Bypasses RLS - use only on the backend (Vercel Serverless Functions)
// REQUER: SUPABASE_SERVICE_ROLE_KEY configurada no Vercel
export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

