/**
 * Billing Repository — Único Ponto de Acesso ao Banco de Dados para Billing
 * 
 * Aqui MORRE qualquer SQL espalhado. Isolado via service_role.
 */
import { supabaseAdmin } from '../../../lib/supabase.js';

export const billingRepository = {
  async getBillingEvents(userId, limit = 100) {
    try {
      const { data, error } = await supabaseAdmin
        .from('billing_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[BillingRepo] billing_events query warning:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('[BillingRepo] billing_events exception:', err.message);
      return [];
    }
  },

  async getLedger(userId, limit = 100) {
    try {
      const { data, error } = await supabaseAdmin
        .from('billing_ledger')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[BillingRepo] billing_ledger query warning:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('[BillingRepo] billing_ledger exception:', err.message);
      return [];
    }
  },

  async getSubscription(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[BillingRepo] subscriptions query warning:', error.message);
        return null;
      }
      return data || null;
    } catch (err) {
      console.warn('[BillingRepo] subscriptions exception:', err.message);
      return null;
    }
  },

  async resolveUser(userIdOrSearch) {
    if (!userIdOrSearch) return null;
    const term = String(userIdOrSearch).trim().toLowerCase();

    // 1. Se contiver '@', buscar nativamente pelo e-mail
    if (term.includes('@')) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(term);
        if (!error && data?.user) {
          return {
            id: data.user.id,
            email: data.user.email,
            createdAt: data.user.created_at
          };
        }
      } catch (err) {
        console.warn('[BillingRepo] resolveUser getUserByEmail error:', err.message);
      }
    } else {
      // 2. Tentar buscar diretamente por UUID de usuário
      try {
        const { data, error } = await supabaseAdmin.auth.admin.getUser(term);
        if (!error && data?.user) {
          return {
            id: data.user.id,
            email: data.user.email,
            createdAt: data.user.created_at
          };
        }
      } catch (err) {
        console.warn('[BillingRepo] resolveUser getUser error:', err.message);
      }
    }

    // 3. Fallback: Tentar via tabela subscriptions se não encontrou no auth list
    try {
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('user_id')
        .or(`asaas_subscription_id.eq.${term},asaas_customer_id.eq.${term},user_id.eq.${term}`)
        .limit(1)
        .maybeSingle();

      if (sub) {
        try {
          const { data, error } = await supabaseAdmin.auth.admin.getUser(sub.user_id);
          if (!error && data?.user) {
            return {
              id: data.user.id,
              email: data.user.email,
              createdAt: data.user.created_at
            };
          }
        } catch (_) {}
        return { id: sub.user_id, email: null, createdAt: null };
      }
    } catch (err) {
      console.warn('[BillingRepo] resolveUser sub search error:', err.message);
    }

    // 4. Fallback final: Buscar na tabela profiles por name ou nickname
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, name, nickname, created_at')
        .or(`name.ilike.%${term}%,nickname.ilike.%${term}%`)
        .limit(1)
        .maybeSingle();

      if (profile) {
        return {
          id: profile.id,
          email: null,
          name: profile.name || profile.nickname || '',
          createdAt: profile.created_at
        };
      }
    } catch (err) {
      console.warn('[BillingRepo] resolveUser profiles search error:', err.message);
    }

    return null;
  }
};
