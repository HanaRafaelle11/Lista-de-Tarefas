// Vercel Serverless Function: /api/debug/events.js

import { supabaseAdmin } from '../../lib/supabase.js';

export default async function handler(req, res) {
  // Configuração do CORS
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    let client = supabaseAdmin;
    let clientType = 'service_role';

    // Se o cliente enviar o cabeçalho Authorization, usamos a chave anon com o JWT dele para simular RLS
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        client = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: authHeader
            }
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
        clientType = 'anon_jwt';
      }
    }

    // Executa a função RPC debug_events que retorna auth.uid() e current_user
    const { data, error } = await client.rpc('debug_events');

    if (error) {
      return res.status(200).json({
        error: error.message,
        hint: "Caso a função não exista, execute a migração supabase_migration_v18_debug_events.sql no console do Supabase.",
        clientType
      });
    }

    return res.status(200).json({
      clientType,
      auth_uid: data.auth_uid,
      current_user: data.current_user
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
