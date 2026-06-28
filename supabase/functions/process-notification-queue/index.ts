import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing environment keys' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    // 1. Buscar itens pendentes
    const { data: pendingItems, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .lte('scheduled_for', now)
      .in('status', ['pending', 'failed'])
      .lt('attempts', 3)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    let processedCount = 0;
    let successCount = 0;

    if (pendingItems && pendingItems.length > 0) {
      for (const item of pendingItems) {
        // Trava atômica optimista
        const { error: lockError } = await supabase
          .from('notification_queue')
          .update({ status: 'processing', attempts: item.attempts + 1 })
          .eq('id', item.id)
          .eq('status', item.status);

        if (lockError) continue;
        processedCount++;

        // Buscar assinaturas
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', item.user_id);

        if (subs && subs.length > 0) {
          // Registrar log de auditoria
          await supabase.from('notification_logs').insert({
            notification_id: item.id,
            task_id: item.entity_id,
            user_id: item.user_id,
            status: 'sent',
            error_message: null
          });
          
          await supabase
            .from('notification_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', item.id);
          
          successCount++;
        } else {
          await supabase
            .from('notification_queue')
            .update({ status: 'failed', last_error: 'Sem assinaturas ativas' })
            .eq('id', item.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: 'Worker executado com sucesso', processed: processedCount, success: successCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
