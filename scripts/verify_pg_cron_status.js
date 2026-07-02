import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente no .env.local.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verifyCron() {
  console.log('========================================================');
  console.log('🔍 AUDITORIA DO AGENDADOR PG_CRON & PG_NET NO SUPABASE');
  console.log('========================================================');
  console.log(`Conectando a: ${supabaseUrl}`);

  try {
    const { data, error } = await supabase.rpc('check_push_cron_status');

    if (error) {
      if (error.message.includes('function public.check_push_cron_status() does not exist')) {
        console.error('\n❌ ERRO: A função RPC de diagnóstico não está instalada no banco de dados.');
        console.log('\n👉 Como corrigir:');
        console.log('Copie todo o conteúdo do arquivo abaixo e execute no SQL Editor do seu Supabase Dashboard:');
        console.log(`[supabase/migrations/20260702080000_push_cron_diagnostics_rpc.sql](file:///${path.resolve('supabase/migrations/20260702080000_push_cron_diagnostics_rpc.sql')})`);
      } else {
        console.error('\n❌ Falha ao chamar check_push_cron_status:', error.message);
      }
      process.exit(1);
    }

    console.log(`\n🕒 Hora do Relatório: ${data.timestamp}`);
    
    // 1. Extensões
    console.log('\n--- 🛠️ status de Extensões ---');
    console.log(`Extension pg_cron: ${data.pg_cron_installed ? '🟢 INSTALADA' : '🔴 NÃO ENCONTRADA'}`);
    console.log(`Extension pg_net : ${data.pg_net_installed ? '🟢 INSTALADA' : '🔴 NÃO ENCONTRADA'}`);

    // 2. Métricas da Fila
    console.log('\n--- 📊 Métricas de Fila (notification_queue) ---');
    if (data.queue_metrics) {
      console.log(`- Total de Notificações Registradas: ${data.queue_metrics.total}`);
      console.log(`  * Pendentes: ${data.queue_metrics.pending}`);
      console.log(`  * Em Processamento: ${data.queue_metrics.processing}`);
      console.log(`  * Enviadas (antigo): ${data.queue_metrics.sent}`);
      console.log(`  * Concluídas (atual): ${data.queue_metrics.completed}`);
      console.log(`  * Falhas: ${data.queue_metrics.failed}`);
      console.log(`  * Canceladas: ${data.queue_metrics.cancelled}`);
    } else {
      console.log('⚠️ Métricas da fila indisponíveis.');
    }

    // 3. Constraints do banco de dados (CHECKs de status)
    console.log('\n--- 🔒 CHECK Constraints de Status (notification_queue) ---');
    if (data.notification_queue_constraints?.length > 0) {
      data.notification_queue_constraints.forEach((c) => {
        if (c.definition.includes('status')) {
          console.log(`- Nome: ${c.name} | Definição: ${c.definition}`);
        }
      });
    } else {
      console.log('Nenhuma constraint de status encontrada.');
    }

    // 4. Jobs ativos
    console.log('\n--- 📅 Jobs Agendados (cron.job) ---');
    if (data.active_jobs?.length > 0) {
      data.active_jobs.forEach((job) => {
        console.log(`- Job: [${job.jobname}] | ID: ${job.jobid}`);
        console.log(`  Schedule: "${job.schedule}" | Active: ${job.active}`);
        console.log(`  Command : ${job.command.substring(0, 120)}...`);
      });
    } else {
      console.log('⚠️ Nenhum job encontrado na tabela cron.job.');
    }

    // 5. Execuções recentes
    console.log('\n--- ⚙️ Execuções Recentes dos Jobs (cron.job_run_details) ---');
    if (data.recent_executions?.length > 0) {
      data.recent_executions.forEach((run) => {
        const icon = run.status === 'succeeded' ? '🟢' : '🔴';
        console.log(`${icon} [${run.start_time}] Run #${run.runid} | Job ID: ${run.jobid}`);
        console.log(`   Status: ${run.status} | Return Msg: ${run.return_message || 'Nenhum'}`);
      });
    } else {
      console.log('Nenhum registro de execução encontrado em cron.job_run_details.');
    }

    // 6. Respostas HTTP reais do pg_net
    console.log('\n--- 🌐 Respostas HTTP das Edge Functions (net.http_responses) ---');
    if (data.recent_http_responses?.length > 0) {
      data.recent_http_responses.forEach((res) => {
        const icon = res.status_code >= 200 && res.status_code < 300 ? '🟢' : '🔴';
        console.log(`${icon} [${res.created_at}] ID: ${res.id}`);
        console.log(`   HTTP Status: ${res.status_code} | Text: ${res.status_text || 'Nenhum'}`);
      });
    } else {
      console.log('Nenhuma resposta HTTP encontrada em net.http_responses.');
    }

    // 7. Erros HTTP do pg_net
    console.log('\n--- ⚠️ Erros de Rede Recentes (net.http_errors) ---');
    if (data.recent_http_errors?.length > 0) {
      data.recent_http_errors.forEach((err) => {
        console.log(`🔴 [${err.created_at}] Request ID: ${err.id}`);
        console.log(`   Error Msg: ${err.error_message}`);
      });
    } else {
      console.log('🟢 Nenhum erro de rede registrado em net.http_errors.');
    }

    console.log('\n========================================================');
    console.log('✅ AUDITORIA CONCLUÍDA!');
    console.log('========================================================');

  } catch (err) {
    console.error('❌ Erro inesperado ao auditar:', err.message);
    process.exit(1);
  }
}

verifyCron().catch(console.error);
