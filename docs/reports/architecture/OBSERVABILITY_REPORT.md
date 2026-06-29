# OBSERVABILITY & TRACEABILITY REPORT (OBSERVABILITY_REPORT)
**Produto:** Flowday 3.0  
**Data da Auditoria:** 2026-06-29  
**Status da Observabilidade:** 🟢 TOTALMENTE RASTREÁVEL (JSON Logs + Trace Propagation)

---

## 1. OBJETIVO
Garantir que todas as transações críticas (faturamento, envio de notificações, execuções de workers) produzam logs estruturados e propaguem identificadores de rastreamento únicos (`traceId` / `trace_id`), permitindo auditoria forense instantânea de erros em produção.

---

## 2. ESTRUTURA DOS LOGS EM PRODUÇÃO
O Flowday 3.0 adota um padrão de logs em formato JSON para facilitar a ingestão e indexação em serviços como Vercel Logs, Datadog ou Supabase Logs.

### Exemplo de Log de Faturamento (Consolidated Billing Engine):
```json
{
  "level": "info",
  "service": "billing",
  "event": "lock_acquired",
  "trace_id": "b9970503-33b5-4449-ae7c-e97b6cb67ede",
  "timestamp": "2026-06-29T19:22:24.554Z",
  "metadata": {
    "key": "subscription:user_retry",
    "owner": "5cff403f-0cec-410f-b737-30bab7662128",
    "expires_at": "2026-06-29T19:22:29.553Z"
  }
}
```

---

## 3. PROPAGAÇÃO E RASTREAMENTO DE TRACE ID
Toda requisição ou processo em lote inicia um contexto com um ID exclusivo, que é propagado em todas as chamadas de banco e serviços de terceiros:

1.  **Worker Loop Execution:**
    *   Trace ID gerado na inicialização: `trc_loop_1782760856795_dykn6`.
    *   Propagado para o processador de push:
        ```json
        {"level":"INFO","event":"notification.service.processPendingQueue.start","timestamp":"...","traceId":"trc_loop_1782760856795_dykn6"}
        ```
    *   Propagado para erros individuais da fila:
        ```json
        {"level":"ERROR","event":"notification.service.job_processing_failed","timestamp":"...","traceId":"trc_loop_1782760856795_dykn6","jobId":"...","error":"No active push subscriptions..."}
        ```
2.  **System Status API:**
    *   Trace ID gerado: `trc_sys_status_1782760859837_eely1`.
    *   Propagado para avisos de queries falhas (ex: tabelas opcionais ausentes):
        ```json
        {"level":"WARN","event":"api.admin.systemStatus.queryFailed","timestamp":"...","traceId":"trc_sys_status_1782760859837_eely1","queryName":"user_risk_profile.existence",...}
        ```

---

## 4. CONCLUSÃO
O sistema possui excelente cobertura de observabilidade. Qualquer erro na API ou falha de entrega no webhook/push pode ser correlacionada instantaneamente por meio da busca do `traceId` nos logs de produção do servidor e nas tabelas do Supabase.
