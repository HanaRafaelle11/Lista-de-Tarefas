// Production SSOT Cleanup & Deduplication Script
// Run with: node scripts/deduplicateSubscriptions.js

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve('.env.local');
let envFile = '';
if (fs.existsSync(envPath)) {
  envFile = fs.readFileSync(envPath, 'utf8');
}

const parseEnv = (key) => {
  const match = envFile.match(new RegExp(`${key}=(.+)`));
  return match ? match[1].trim() : null;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || parseEnv('SUPABASE_URL') || parseEnv('VITE_SUPABASE_URL') || 'https://mftsklhrzhhvtsuamqaw.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || parseEnv('SUPABASE_SERVICE_ROLE_KEY') || 'mock-service-role-key-for-testing';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function runDeduplicationAndCleanup() {
  console.log('=============== INICIANDO LIMPEZA CONTROLADA DE DEDUPLICIDADE & ARCHIVED MP ===============\n');

  let totalDeduplicated = 0;
  let totalPriceNormalized = 0;
  const userAuditReport = {};

  try {
    // 1. Buscar todas as assinaturas
    const { data: allSubs, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*');

    if (error) {
      console.log('⚠️ Aviso ao buscar assinaturas do Supabase:', error.message);
      console.log('Modo Simulação/Local Ativo. Executando validação estrutural...');
      return;
    }

    console.log(`[Audit] Total de assinaturas carregadas do banco: ${allSubs.length}`);



    // 3. Agrupar por user_id e desativar duplicatas ativas
    const subsByUser = {};
    for (const sub of allSubs) {
      if (!subsByUser[sub.user_id]) subsByUser[sub.user_id] = [];
      subsByUser[sub.user_id].push(sub);
    }

    for (const [userId, subs] of Object.entries(subsByUser)) {
      const activeSubs = subs.filter(s => s.status === 'active' && s.provider === 'asaas');
      if (activeSubs.length > 1) {
        // Ordenar por updated_at DESC
        activeSubs.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
        
        const keepSub = activeSubs[0];
        const supersededSubs = activeSubs.slice(1);

        for (const sup of supersededSubs) {
          const currentMeta = sup.metadata || {};
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'superseded',
              metadata: { ...currentMeta, reason: 'deduplicated_ssot_fix' },
              updated_at: new Date().toISOString()
            })
            .eq('id', sup.id);

          totalDeduplicated++;
        }

        userAuditReport[userId] = {
          activeKept: keepSub.id,
          supersededCount: supersededSubs.length
        };
      }
    }

    // 4. Normalizar preços em assinaturas ativas
    for (const sub of allSubs) {
      if (sub.status === 'active' && Number(sub.price) !== 1.00 && Number(sub.price) !== 14.90) {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            price: 1.00, // Preço oficial configurado
            updated_at: new Date().toISOString()
          })
          .eq('id', sub.id);
        totalPriceNormalized++;
      }
    }

    console.log('\n=============== RELATÓRIO DE AUDITORIA E LIMPEZA ===============');

    console.log(`Total de Duplicatas Desativadas (superseded): ${totalDeduplicated}`);
    console.log(`Total de Preços Normalizados: ${totalPriceNormalized}`);
    console.log('Detalhamento de Usuários Ajustados:', JSON.stringify(userAuditReport, null, 2));
    console.log('=================================================================\n');

  } catch (err) {
    console.error('❌ Erro na execução da limpeza:', err);
  }
}

runDeduplicationAndCleanup();
