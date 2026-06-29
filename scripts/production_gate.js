import { validateSchema } from './schema_validator.js';
import { testNotificationPipeline } from './notification_e2e_test.js';
import { checkWorkerHealth } from './worker_health_checker.js';
import systemStatusHandler from '../api-handlers/admin/system-status.js';
import { logger } from '../lib/logger.js';

console.log('================================================================');
console.log('🛡️  FLOWDAY DEPLOYMENT SAFETY GATE (PRODUCTION GATE v1)');
console.log('================================================================');

async function runProductionGate() {
  const gateReport = {
    deployAllowed: true,
    confidence: 'production_safe',
    timestamp: new Date().toISOString(),
    checks: {
      schema: null,
      notifications: null,
      worker: null,
      systemStatus: null
    },
    failures: []
  };

  // 1. PHASE 1: Schema Integrity Check
  console.log('\n🔍 [Fase 1] Executando Validação de Drift de Schema...');
  const schemaRes = await validateSchema();
  gateReport.checks.schema = {
    valid: !schemaRes.criticalMismatch,
    missingTables: schemaRes.missingTables,
    missingColumns: schemaRes.missingColumns
  };

  if (schemaRes.criticalMismatch) {
    gateReport.deployAllowed = false;
    gateReport.confidence = 'unsafe';
    gateReport.failures.push({
      phase: 'SCHEMA',
      reason: 'Critical schema drift detected. Core tables or columns missing.',
      details: { missingTables: schemaRes.missingTables, missingColumns: schemaRes.missingColumns }
    });
  }

  // 2. PHASE 2: Notification Pipeline Check
  console.log('\n🔍 [Fase 2] Validando Pipeline E2E de Notificações...');
  const notifRes = await testNotificationPipeline();
  gateReport.checks.notifications = {
    success: notifRes.pipelineSuccess,
    stepFailed: notifRes.stepFailed,
    details: notifRes.details
  };

  if (!notifRes.pipelineSuccess) {
    gateReport.deployAllowed = false;
    gateReport.confidence = 'unsafe';
    gateReport.failures.push({
      phase: 'NOTIFICATIONS',
      reason: 'Notification delivery test failed.',
      step: notifRes.stepFailed,
      details: notifRes.details
    });
  }

  // 3. PHASE 3: Worker Loop Health Check
  console.log('\n🔍 [Fase 3] Validando Loop de Fila do Worker...');
  const workerRes = await checkWorkerHealth();
  gateReport.checks.worker = {
    stable: workerRes.workerStable,
    details: workerRes.details
  };

  if (!workerRes.workerStable) {
    gateReport.deployAllowed = false;
    gateReport.confidence = 'unsafe';
    gateReport.failures.push({
      phase: 'WORKER',
      reason: 'Worker loop execution returned errors or instabilties.',
      details: workerRes.details
    });
  }

  // 4. PHASE 4: System Status API Verification
  console.log('\n🔍 [Fase 4] Validando API de Status do Sistema (Truth Observability)...');
  const mockReq = {};
  const mockRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };

  try {
    await systemStatusHandler(mockReq, mockRes);
    const body = mockRes.body;

    gateReport.checks.systemStatus = {
      httpStatus: mockRes.statusCode,
      schemaHealth: body?.schemaHealth,
      missingColumns: body?.missingColumns || [],
      failedQueriesCount: body?.failedQueries?.length || 0
    };

    if (mockRes.statusCode !== 200) {
      gateReport.deployAllowed = false;
      gateReport.failures.push({
        phase: 'SYSTEM_STATUS_API',
        reason: `System-status returned non-200 HTTP code: ${mockRes.statusCode}`
      });
    }

    if (body?.schemaHealth === 'mismatch') {
      gateReport.deployAllowed = false;
      gateReport.confidence = 'unsafe';
      gateReport.failures.push({
        phase: 'SYSTEM_STATUS_OBSERVABILITY',
        reason: 'System status API reports active database schema mismatch.',
        details: body.failedQueries
      });
    }

  } catch (err) {
    gateReport.deployAllowed = false;
    gateReport.failures.push({
      phase: 'SYSTEM_STATUS_API',
      reason: `System-status API threw exception: ${err.message}`
    });
  }

  // FINAL DEPLOY DECISION ENGINE
  console.log('\n================================================================');
  console.log('📊 DEPLOYMENT Safety GATE DECISION ENGINE');
  console.log('================================================================');
  console.log('Resultado do Gate:', JSON.stringify(gateReport, null, 2));

  if (!gateReport.deployAllowed) {
    console.error('\n🔴 DEPLOY BLOQUEADO! Riscos críticos detectados pré-produção.');
    process.exit(1);
  } else {
    console.log('\n🟢 DEPLOY LIBERADO! A base de código e banco estão 100% alinhados para produção.');
    process.exit(0);
  }
}

runProductionGate();
