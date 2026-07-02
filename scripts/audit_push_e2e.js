import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env'); process.exit(1); }

const supabase = createClient(supabaseUrl, serviceRoleKey);
const report = [];
const log = (msg) => { console.log(msg); report.push(msg); };

async function audit() {
  log('════════════════════════════════════════════════════════════════');
  log('  AUDITORIA E2E DO PIPELINE DE PUSH NOTIFICATIONS (MyFlowDay)');
  log('  Timestamp: ' + new Date().toISOString());
  log('════════════════════════════════════════════════════════════════');

  // ═══════════════════════════════════════════════════════════════
  // 1. NOTIFICATION QUEUE
  // ═══════════════════════════════════════════════════════════════
  log('\n╔══ 1. NOTIFICATION_QUEUE ══╗');
  const { data: queueAll, error: qErr } = await supabase
    .from('notification_queue')
    .select('id, status, title, scheduled_for, attempts, max_attempts, last_error, sent_at, created_at, user_id, idempotency_key, provider_status, provider_message_id, provider_response')
    .order('created_at', { ascending: false }).limit(50);

  if (qErr) {
    log(`  ❌ Erro: ${qErr.message}`);
    // Fallback sem colunas extras
    const { data: qFallback } = await supabase
      .from('notification_queue')
      .select('id, status, title, scheduled_for, attempts, last_error, sent_at, created_at, user_id')
      .order('created_at', { ascending: false }).limit(50);
    if (qFallback) analyzeQueue(qFallback);
  } else {
    analyzeQueue(queueAll);
  }

  function analyzeQueue(q) {
    const statuses = {};
    (q || []).forEach(r => { statuses[r.status] = (statuses[r.status] || 0) + 1; });
    log(`  Total consultado: ${(q || []).length}`);
    log('  Distribuição:');
    Object.entries(statuses).forEach(([k, v]) => log(`    ${k}: ${v}`));

    const stuck = (q || []).filter(r => r.status === 'processing');
    log(`  Presos em 'processing': ${stuck.length}`);
    stuck.forEach(s => log(`    ID=${s.id} created_at=${s.created_at}`));

    const pending = (q || []).filter(r => r.status === 'pending');
    log(`  Pendentes: ${pending.length}`);
    pending.slice(0, 3).forEach(r => log(`    ID=${r.id} scheduled=${r.scheduled_for} title="${(r.title||'').substring(0,50)}"`));

    const failed = (q || []).filter(r => r.status === 'failed');
    log(`  Falhas: ${failed.length}`);
    failed.slice(0, 5).forEach(r => log(`    ID=${r.id} attempts=${r.attempts} error="${(r.last_error||'').substring(0,150)}"`));

    const sent = (q || []).filter(r => r.status === 'sent' || r.status === 'completed');
    log(`  Enviados/Completos: ${sent.length}`);
    sent.slice(0, 3).forEach(r => {
      let extra = '';
      if (r.provider_status) extra += ` provider_http=${r.provider_status}`;
      if (r.provider_message_id) extra += ` msg_id=${(r.provider_message_id||'').substring(0,60)}`;
      log(`    ID=${r.id} status=${r.status} sent_at=${r.sent_at}${extra}`);
    });

    // Check provider 410s
    const gone410 = (q || []).filter(r => r.provider_status === 410 || (r.last_error||'').includes('410'));
    if (gone410.length > 0) {
      log(`  🔴 Registros com Provider HTTP 410 Gone: ${gone410.length}`);
      log(`    → 410 significa que o endpoint push do navegador expirou. A subscription deve ser removida e o usuário precisa se reinscrever.`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. PUSH SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════
  log('\n╔══ 2. PUSH_SUBSCRIPTIONS ══╗');
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, updated_at, created_at')
    .order('updated_at', { ascending: false });

  const allSubs = subs || [];
  log(`  Total: ${allSubs.length}`);

  const noKeys = allSubs.filter(s => !s.p256dh || !s.auth);
  log(`  Sem chaves p256dh/auth: ${noKeys.length}${noKeys.length > 0 ? ' 🔴' : ' 🟢'}`);

  const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000);
  const expired = allSubs.filter(s => new Date(s.updated_at) < thirtyDaysAgo);
  log(`  Expiradas (>30 dias): ${expired.length}`);

  const uniqueUsers = new Set(allSubs.map(s => s.user_id));
  log(`  Usuários únicos: ${uniqueUsers.size}`);

  const endpoints = allSubs.map(s => s.endpoint);
  const dupes = endpoints.length - new Set(endpoints).size;
  log(`  Endpoints duplicados: ${dupes}${dupes > 0 ? ' ⚠️' : ' 🟢'}`);

  // Subscriptions por usuário
  const perUser = {};
  allSubs.forEach(s => { perUser[s.user_id] = (perUser[s.user_id] || 0) + 1; });
  log('  Subscriptions por usuário:');
  Object.entries(perUser).forEach(([uid, cnt]) => log(`    ${uid}: ${cnt} subscriptions`));

  // ═══════════════════════════════════════════════════════════════
  // 3. NOTIFICATION LOGS
  // ═══════════════════════════════════════════════════════════════
  log('\n╔══ 3. NOTIFICATION_LOGS (Evidência de envio real) ══╗');
  const { data: nLogs, error: nlErr } = await supabase
    .from('notification_logs')
    .select('*')
    .order('created_at', { ascending: false }).limit(20);

  if (nlErr) {
    log(`  ❌ Erro: ${nlErr.message}`);
  } else {
    const logs = nLogs || [];
    log(`  Total consultado: ${logs.length}`);
    const sentL = logs.filter(l => l.status === 'sent');
    const failL = logs.filter(l => l.status === 'failed');
    log(`  Enviados: ${sentL.length} | Falhas: ${failL.length}`);

    // Extrair HTTP status codes do provider
    const httpCodes = {};
    logs.forEach(l => {
      if (l.provider_status) httpCodes[l.provider_status] = (httpCodes[l.provider_status] || 0) + 1;
    });
    if (Object.keys(httpCodes).length > 0) {
      log('  🌐 Códigos HTTP do Provider (FCM):');
      Object.entries(httpCodes).forEach(([code, cnt]) => {
        let label = '';
        if (code == 201) label = ' (Created — SUCESSO REAL)';
        else if (code == 410) label = ' (Gone — ENDPOINT EXPIRADO)';
        else if (code == 404) label = ' (Not Found)';
        else if (code == 401) label = ' (Unauthorized — VAPID INVÁLIDO)';
        else if (code == 403) label = ' (Forbidden)';
        else if (code == 413) label = ' (Payload Too Large)';
        else if (code == 429) label = ' (Rate Limited)';
        log(`      HTTP ${code}: ${cnt} ocorrências${label}`);
      });
    }

    // Últimos 5 logs detalhados
    log('  Últimos 5 registros:');
    logs.slice(0, 5).forEach(l => {
      log(`    [${l.created_at}] status=${l.status} provider_http=${l.provider_status || 'N/A'}`);
      log(`      title="${(l.title||'').substring(0,60)}" user=${l.user_id}`);
      if (l.error_message) log(`      error: ${(l.error_message||'').substring(0,150)}`);
      if (l.provider_response) {
        try {
          const pr = typeof l.provider_response === 'string' ? JSON.parse(l.provider_response) : l.provider_response;
          if (Array.isArray(pr)) {
            pr.forEach((r, i) => {
              log(`      Device[${i}]: http=${r.statusCode} success=${r.success} msgId=${(r.message_id||'').substring(0,60)}`);
              if (r.error) log(`        error: ${r.error.substring(0,120)}`);
            });
          }
        } catch (_) {
          log(`      provider_response (raw): ${String(l.provider_response).substring(0,200)}`);
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. NOTIFICATION DELIVERIES (truth layer)
  // ═══════════════════════════════════════════════════════════════
  log('\n╔══ 4. NOTIFICATION_DELIVERIES ══╗');
  const { data: deliveries, error: dErr } = await supabase
    .from('notification_deliveries')
    .select('*')
    .order('created_at', { ascending: false }).limit(30);

  if (dErr) {
    log(`  ⚠️ ${dErr.message}`);
  } else {
    const dels = deliveries || [];
    log(`  Total: ${dels.length}`);
    if (dels.length > 0) {
      const dStatuses = {};
      dels.forEach(d => { dStatuses[d.status] = (dStatuses[d.status] || 0) + 1; });
      Object.entries(dStatuses).forEach(([k, v]) => log(`    ${k}: ${v}`));
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. PUSH TELEMETRY (Frontend ↔ SW)
  // ═══════════════════════════════════════════════════════════════
  log('\n╔══ 5. PUSH_TELEMETRY ══╗');
  const { data: tel } = await supabase
    .from('push_telemetry')
    .select('*')
    .order('created_at', { ascending: false }).limit(30);

  const telData = tel || [];
  log(`  Total: ${telData.length}`);
  const telByType = {};
  telData.forEach(t => { telByType[t.event_type] = (telByType[t.event_type] || 0) + 1; });
  Object.entries(telByType).forEach(([k, v]) => log(`    ${k}: ${v}`));

  const swReceived = telData.filter(t => t.event_type === 'received');
  log(`  Recebimentos confirmados pelo Service Worker: ${swReceived.length}`);
  if (swReceived.length > 0) log(`    Último: ${swReceived[0].created_at}`);

  const regFails = telData.filter(t => t.status === 'failed');
  if (regFails.length > 0) {
    log(`  🔴 Falhas de telemetria: ${regFails.length}`);
    regFails.slice(0, 3).forEach(t => log(`    [${t.created_at}] ${t.endpoint}: ${(t.error||'').substring(0,120)}`));
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. VAPID KEY CHECK
  // ═══════════════════════════════════════════════════════════════
  log('\n╔══ 6. VAPID KEYS ══╗');
  const pub = process.env.VITE_PUBLIC_VAPID_KEY;
  const priv = process.env.PRIVATE_VAPID_KEY;
  log(`  Pública: ${pub ? pub.substring(0,25)+'...' : '🔴 AUSENTE'}`);
  log(`  Privada: ${priv ? '[PRESENTE]' : '🔴 AUSENTE'}`);
  if (pub && priv) {
    try {
      const wp = await import('web-push');
      wp.default.setVapidDetails('mailto:admin@myflowday.com', pub, priv);
      wp.default.getVapidHeaders('https://fcm.googleapis.com/fcm/send/test', 'mailto:admin@myflowday.com', pub, priv, 'aes128gcm');
      log('  🟢 Par VAPID válido.');
    } catch (e) { log(`  🔴 VAPID inválido: ${e.message}`); }
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. DIAGNÓSTICO FINAL
  // ═══════════════════════════════════════════════════════════════
  log('\n╔══ 7. DIAGNÓSTICO FINAL — ONDE O FLUXO PARA? ══╗');

  const hasSubs = allSubs.length > 0;
  const hasValidKeys = allSubs.some(s => s.p256dh && s.auth);
  const hasQueue = (queueAll || []).length > 0;
  const hasSent = (queueAll || []).some(r => r.status === 'sent' || r.status === 'completed');
  const hasFailed = (queueAll || []).some(r => r.status === 'failed');
  const hasSwReceived = swReceived.length > 0;

  // Check for 410s in logs
  const has410 = (nLogs || []).some(l => l.provider_status === 410);
  const has201 = (nLogs || []).some(l => l.provider_status === 201);

  log('  Checklist do Pipeline:');
  log(`    [1] Subscriptions?                ${hasSubs ? '🟢 SIM ('+allSubs.length+')' : '🔴 NÃO'}`);
  log(`    [2] Chaves p256dh/auth?            ${hasValidKeys ? '🟢 SIM' : '🔴 NÃO'}`);
  log(`    [3] Itens na fila?                 ${hasQueue ? '🟢 SIM' : '⚠️ VAZIA'}`);
  log(`    [4] Worker processou?              ${hasSent || hasFailed ? '🟢 SIM' : '🔴 NÃO'}`);
  log(`    [5] FCM retornou 201?              ${has201 ? '🟢 SIM' : '🔴 NÃO'}`);
  log(`    [6] FCM retornou 410?              ${has410 ? '🔴 SIM — endpoints expirados' : '🟢 NÃO'}`);
  log(`    [7] SW confirmou recebimento?      ${hasSwReceived ? '🟢 SIM' : '⚠️ NÃO'}`);

  // Conclusão
  if (has410 && !has201) {
    log('\n  🚨 CONCLUSÃO: O FCM está respondendo 410 Gone para TODOS os endpoints.');
    log('     Isso significa que as subscriptions (endpoints) registradas no banco estão EXPIRADAS.');
    log('     O navegador do usuário gerou novas chaves mas as antigas não foram limpas,');
    log('     ou o usuário desinstalou/reinstalou o PWA sem atualizar a subscription.');
    log('     AÇÃO: Limpar endpoints 410 do banco e forçar re-registro no próximo login.');
  } else if (has201 && hasSwReceived) {
    log('\n  ✅ PIPELINE FUNCIONAL: FCM aceita (201), SW confirma recebimento.');
  } else if (has201 && !hasSwReceived) {
    log('\n  ⚠️ PARCIAL: FCM aceita (201), mas SW não confirmou. Dispositivo pode estar offline.');
  } else if (!hasQueue) {
    log('\n  ⚠️ SEM DADOS: Fila vazia. Crie uma tarefa com due_date passado para testar o trigger.');
  } else {
    log('\n  ⚠️ INDETERMINADO: Insuficientes dados para concluir. Verifique os logs da Edge Function no painel Supabase.');
  }

  log('\n════════════════════════════════════════════════════════════════');
  log('  FIM DA AUDITORIA');
  log('════════════════════════════════════════════════════════════════');

  fs.writeFileSync('docs/push_e2e_audit_report.md',
    '# Relatório de Auditoria E2E — Push Notifications\n\n```\n' + report.join('\n') + '\n```\n', 'utf8');
  log('\n📄 Relatório salvo em: docs/push_e2e_audit_report.md');
}

audit().catch(e => { console.error('Crash:', e); process.exit(1); });
