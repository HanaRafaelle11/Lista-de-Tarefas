import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = !!(supabaseUrl && supabaseAnonKey);

export const REDIRECT_URL = (typeof window !== 'undefined' && window.location.origin.includes('localhost'))
  ? window.location.origin
  : (import.meta.env.VITE_REDIRECT_URL || 'https://myflowday.com.br');

if (!hasSupabaseConfig) {
  console.warn(
    '[MyFlowDay] Variáveis de ambiente do Supabase não encontradas.\n' +
    'Certifique-se de que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidas no arquivo .env.local'
  );
  if (typeof window !== 'undefined') {
    window.supabaseConfigError = true;
  }
}

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    })
  : {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () => ({ data: { user: null }, error: new Error('Supabase não configurado') }),
        signUp: async () => ({ data: { user: null }, error: new Error('Supabase não configurado') }),
        signOut: async () => {},
        updateUser: async () => ({ data: null, error: new Error('Supabase não configurado') }),
      },
      functions: {
        invoke: async () => ({ data: null, error: new Error('Supabase não configurado') }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: new Error('Supabase não configurado') }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: new Error('Supabase não configurado') }),
            select: () => ({
              single: () => Promise.resolve({ data: null, error: new Error('Supabase não configurado') }),
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: new Error('Supabase não configurado') }),
          }),
        }),
      }),
    };

