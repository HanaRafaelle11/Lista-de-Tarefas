import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

export default async function handler(req, res) {
  const start = Date.now();
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const traceId = `trc_sys_status_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  logger.info('api.admin.systemStatus.start', { traceId, timestamp: now.toISOString() });

  if (!supabaseAdmin) {
    return res.status(200).json({
      statusOverall: 'healthy',
      schemaHealth: 'ok',
      missingColumns: [],
      failedQueries: [],
      health: { lastWorkerRun: now.toISOString(), workerStatus: 'OK', lastErrorEvent: null },
      notifications: { pendingCount: 0, sentLast24h: 0, failedLast24h: 0, successRate: 100 },
      billing: { activeSubscriptions: 0, paymentsLast24h: 0, failedPayments: 0 },
      events: { lastErrors: [], lastEvents: [], topEventTypes: [] },
      latencyMs: Date.now() - start
    });
  }

  const failedQueries = [];
  const missingColumns = [];
  let schemaHealth = 'ok';

  // Schema Guard Layer & safeQuery
  const safeQuery = async (queryFn, queryName, fallback, isOptional = false) => {
    try {
      const result = await queryFn();
      if (result && result.error) {
        throw result.error;
      }
      return result;
    } catch (err) {
      if (!isOptional) {
        schemaHealth = 'mismatch';
      }
      const errorMsg = err.message || JSON.stringify(err);
      
      logger.warn('api.admin.systemStatus.queryFailed', {
        traceId,
        queryName,
        error: errorMsg,
        code: err.code,
        isOptional
      });

      failedQueries.push({
        queryName,
        code: err.code || 'UNKNOWN',
        error: errorMsg,
        isOptional
      });

      // Extrai a coluna ou tabela faltante da mensagem de erro do Postgres
      if (err.code === '42703' || errorMsg.includes('column')) {
        const colMatch = errorMsg.match(/column "?([^"\s]+)"?/);
        if (colMatch) missingColumns.push(colMatch[1]);
      } else if (err.code === 'PGRST204' || errorMsg.includes('relation') || errorMsg.includes('Could not find the table')) {
        const tblMatch = errorMsg.match(/(?:table|relation) "?([^"\s]+)"?/);
        if (tblMatch) missingColumns.push(tblMatch[1]);
      }

      return fallback;
    }
  };

  try {
    // Execução paralela de consultas com monitoramento explícito de schema
    const [
      queueRes,
      logs24hRes,
      subsRes,
      billingEventsRes,
      errorsRes,
      lastEventsRes,
      riskRes
    ] = await Promise.all([
      // 1. Fila de Notificações
      safeQuery(
        () => supabaseAdmin.from('notification_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        'notification_queue.pendingCount',
        { count: 0 }
      ),
      // 2. Logs de Notificações (sent_at)
      safeQuery(
        () => supabaseAdmin.from('notification_logs').select('status').gte('sent_at', last24h),
        'notification_logs.sentLast24h',
        { data: [] }
      ),
      // 3. Assinaturas Ativas
      safeQuery(
        () => supabaseAdmin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        'subscriptions.activeCount',
        { count: 0 }
      ),
      // 4. Receita real (billing_events)
      safeQuery(
        () => supabaseAdmin.from('billing_events').select('amount, status').gte('created_at', last24h),
        'billing_events.sales',
        { data: [] }
      ),
      // 5. Erros recentes
      safeQuery(
        () => supabaseAdmin.from('events').select('*').ilike('event_type', '%error%').order('created_at', { ascending: false }).limit(20),
        'events.errors',
        { data: [] }
      ),
      // 6. Fluxo de eventos gerais
      safeQuery(
        () => supabaseAdmin.from('events').select('*').order('created_at', { ascending: false }).limit(20),
        'events.recent',
        { data: [] }
      ),
      // 7. Tabela de Perfil de Risco (Growth OS) - Verifica existência real das tabelas de Growth
      safeQuery(
        () => supabaseAdmin.from('user_risk_profile').select('user_id').limit(0),
        'user_risk_profile.existence',
        { data: [] },
        true
      )
    ]);

    // Métricas de Notificações
    const pendingCount = queueRes.count || 0;
    const logs24h = logs24hRes.data || [];
    const sentLast24h = logs24h.filter(l => l.status === 'sent' || l.status === 'success').length;
    const failedLast24h = logs24h.filter(l => l.status === 'failed').length;
    const total24h = sentLast24h + failedLast24h;
    const successRate = total24h > 0 ? Number(((sentLast24h / total24h) * 100).toFixed(1)) : 100;

    // Métricas de Faturamento
    const activeSubscriptions = subsRes.count || 0;
    const billingEvents = billingEventsRes.data || [];
    const paymentsLast24h = billingEvents.length;
    const failedPayments = billingEvents.filter(e => e.status === 'failed').length;

    // Métricas de eventos por tipo
    const typeCounts = {};
    const allEvents = lastEventsRes.data || [];
    allEvents.forEach(e => {
      typeCounts[e.event_type] = (typeCounts[e.event_type] || 0) + 1;
    });
    const topEventTypes = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Saúde do Worker
    let lastWorkerRun = now.toISOString();
    let workerStatus = 'OK';
    try {
      const lastLogs = await supabaseAdmin
        .from('notification_logs')
        .select('sent_at, status')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (lastLogs.error) throw lastLogs.error;

      const lastLog = lastLogs.data?.[0];
      if (lastLog) {
        lastWorkerRun = lastLog.sent_at || now.toISOString();
        workerStatus = lastLog.status === 'failed' ? 'FAILED' : 'OK';
      }
    } catch (err) {
      schemaHealth = 'mismatch';
      failedQueries.push({
        queryName: 'notification_logs.lastWorkerRun',
        code: err.code || 'UNKNOWN',
        error: err.message
      });
      workerStatus = 'ERROR';
    }

    // Determinação do status overall baseado no alinhamento de schema
    let statusOverall = 'healthy';
    if (schemaHealth === 'mismatch') {
      statusOverall = 'critical'; // Mismatch de schema é falha crítica em nível Enterprise
    } else if (workerStatus === 'FAILED' || failedPayments > 3) {
      statusOverall = 'critical';
    } else if (pendingCount > 50 || successRate < 85) {
      statusOverall = 'degraded';
    }

    const latencyMs = Date.now() - start;
    logger.info('api.admin.systemStatus.finish', { traceId, statusOverall, schemaHealth, latencyMs });

    return res.status(200).json({
      statusOverall,
      schemaHealth,
      missingColumns: [...new Set(missingColumns)],
      failedQueries,
      health: {
        lastWorkerRun,
        workerStatus,
        lastErrorEvent: (errorsRes.data || [])[0] || null
      },
      notifications: {
        pendingCount,
        sentLast24h,
        failedLast24h,
        successRate
      },
      billing: {
        activeSubscriptions,
        paymentsLast24h,
        failedPayments
      },
      events: {
        lastErrors: errorsRes.data || [],
        lastEvents: allEvents,
        topEventTypes
      },
      latencyMs
    });

  } catch (err) {
    const latencyMs = Date.now() - start;
    logger.error('api.admin.systemStatus.fatal', { traceId, error: err.message });
    return res.status(200).json({
      statusOverall: 'critical',
      schemaHealth: 'mismatch',
      missingColumns: ['unknown'],
      failedQueries: [{ queryName: 'fatal_handler', code: err.code || 'UNKNOWN', error: err.message }],
      health: { lastWorkerRun: now.toISOString(), workerStatus: 'ERROR', lastErrorEvent: err.message },
      notifications: { pendingCount: 0, sentLast24h: 0, failedLast24h: 0, successRate: 0 },
      billing: { activeSubscriptions: 0, paymentsLast24h: 0, failedPayments: 0 },
      events: { lastErrors: [], lastEvents: [], topEventTypes: [] },
      latencyMs,
      error: err.message
    });
  }
}
