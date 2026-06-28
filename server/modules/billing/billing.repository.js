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

    try {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const matchedUser = authData?.users?.find(u => 
        u.id === term || (u.email && u.email.toLowerCase().trim() === term)
      );

      if (matchedUser) {
        return {
          id: matchedUser.id,
          email: matchedUser.email,
          createdAt: matchedUser.created_at
        };
      }
    } catch (err) {
      console.warn('[BillingRepo] resolveUser auth list error:', err.message);
    }

    // Fallback: Tentar via tabela subscriptions se não encontrou no auth list
    try {
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('user_id')
        .or(`asaas_subscription_id.eq.${term},asaas_customer_id.eq.${term},user_id.eq.${term}`)
        .limit(1)
        .maybeSingle();

      if (sub) {
        return { id: sub.user_id, email: null, createdAt: null };
      }
    } catch (err) {
      console.warn('[BillingRepo] resolveUser sub search error:', err.message);
    }

    return null;
  }
};
