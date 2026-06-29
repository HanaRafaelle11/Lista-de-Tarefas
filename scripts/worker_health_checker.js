import workerLoopHandler from '../api-handlers/workers/worker-loop.js';

export async function checkWorkerHealth() {
  const result = {
    workerStable: true,
    details: '',
    summary: null
  };

  const mockReq = {};
  const mockRes = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    }
  };

  try {
    console.log('[Worker Checker] Testando execução do Worker Loop...');
    const start = Date.now();
    await workerLoopHandler(mockReq, mockRes);
    const latency = Date.now() - start;

    if (mockRes.statusCode !== 200) {
      result.workerStable = false;
      result.details = `HTTP Status ${mockRes.statusCode} retornado pelo handler.`;
      return result;
    }

    const body = mockRes.body;
    if (!body || !body.traceId || body.ok === undefined) {
      result.workerStable = false;
      result.details = 'Payload retornado inválido (faltando traceId ou ok).';
      return result;
    }

    if (body.errors && body.errors.length > 0) {
      // Se houver erros do tipo SCHEMA_MISMATCH, marcar como instável
      const schemaErrors = body.errors.filter(e => e.error?.includes('SCHEMA_MISMATCH'));
      if (schemaErrors.length > 0) {
        result.workerStable = false;
        result.details = `Erros de schema detectados no loop: ${JSON.stringify(schemaErrors)}`;
        return result;
      }
    }

    result.summary = body.summary;
    console.log(`[Worker Checker] Worker Loop estável. Trace ID: ${body.traceId} | Latência: ${latency}ms`);

  } catch (err) {
    result.workerStable = false;
    result.details = `Erro não tratado ao chamar o handler: ${err.message}`;
  }

  return result;
}
