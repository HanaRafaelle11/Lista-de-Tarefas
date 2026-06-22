import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('[Supabase Admin] SUPABASE_URL não configurada no ambiente.');
}

if (!supabaseServiceKey) {
  console.warn('[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY ou fallbacks não configurados no ambiente. Webhooks/checkout que exigem admin role podem falhar.');
}

// Bypasses RLS - use only on the backend (Vercel Serverless Functions)
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
