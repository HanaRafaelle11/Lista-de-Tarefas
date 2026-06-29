# SCHEMA DRIFT & INTEGRITY AUDIT REPORT (SCHEMA_REPORT)
**Produto:** Flowday 3.0  
**Data da Auditoria:** 2026-06-29  
**Status do Schema:** 🟡 DRIFT DETECTADO (Tolerável + Corrigível)

---

## 1. OBJETIVO
Verificar se o schema do banco de dados remoto **Supabase** de produção corresponde à especificação exigida pelo código de produção em [supabase.schema.expected.json](file:///c:/Users/rafox/OneDrive/Documentos/07%20Lista%20de%20tarefas/supabase.schema.expected.json).

---

## 2. INVENTÁRIO DO SCHEMA E EVIDÊNCIAS DE DRIFT

A execução do validador de schema (`node scripts/checkSchemaDrift.js`) e do validador do portão (`node scripts/production_gate.js`) revelou o seguinte cenário detalhado:

### A. Tabelas CORE (Alinhadas)
Todas as tabelas críticas para o funcionamento básico e ciclo de vida do usuário existem no banco de dados remoto e possuem as colunas corretas:
*   `profiles` (ID, plano, assinatura_status, etc.) — **OK**
*   `tasks` (ID, user_id, title, completed, completed_at) — **OK**
*   `events` (ID, user_id, event_type, metadata, created_at) — **OK**
*   `subscriptions` (ID, user_id, status, plan, price, etc.) — **OK**
*   `billing_events` (ID, payment_id, user_id, status, created_at) — **OK**
*   `push_subscriptions` (ID, user_id, endpoint, p256dh, auth) — **OK**
*   `notification_queue` (ID, status, attempts, sent_at, etc.) — **OK**
*   `notification_logs` (ID, user_id, status, sent_at, error_message) — **OK**

### B. Tabelas Opcionais / Growth OS (Ausentes - Drift Tolerado)
As tabelas que sustentam a infraestrutura do Growth OS e do Retention Engine não existem no banco de dados de produção:
*   `user_risk_profile` — **AUSENTE**
*   `revenue_leaks` — **AUSENTE**
*   `growth_actions` — **AUSENTE**
*   `growth_action_results` — **AUSENTE**

*Nota: O script [production_gate.js](file:///c:/Users/rafox/OneDrive/Documentos/07%20Lista%20de%20tarefas/scripts/production_gate.js) tolera essa ausência e aprova o deploy por tratar o Growth OS como opcional (graceful degradation).*

### C. Tabela de Feedback (Ausente - DRIFT CRÍTICO)
*   `feedback` — **AUSENTE**
*   **Impacto:** Usuários que tentam enviar feedback pela aba Configurações ([SettingsView.jsx](file:///c:/Users/rafox/OneDrive/Documentos/07%20Lista%20de%20tarefas/src/components/SettingsView.jsx)) sofrem falha na chamada `.from('feedback').insert(...)` e o aplicativo é forçado a usar o fallback local.

---

## 3. FALSO POSITIVO IDENTIFICADO NAS VISÕES ANALÍTICAS

O validador padrão `checkSchemaDrift.js` reportou as seguintes visões analíticas como `MISSING`/`DRIFT DETECTED`:
*   `vw_mrr_metrics`
*   `vw_churn_metrics`
*   `vw_arpu_metrics`
*   `vw_cohort_retention`
*   `vw_growth_metrics`

### Análise da Causa Raiz
As visões **existem** no Supabase e retornam dados corretos quando consultadas pelo servidor ([scratch/test_views.js](file:///c:/Users/rafox/OneDrive/Documentos/07%20Lista%20de%20tarefas/scratch/test_views.js)):
```json
vw_mrr_metrics: ✅ [{"date":"2026-05-31","mrr":0,"arr":0,"churn_adjusted_mrr":0}]
vw_cohort_retention: ✅ [{"cohort_month":"2026-06-01","period":0,"active_users":3,"total_users":3,"retention_rate":100}]
```

No entanto, as migrações de segurança ([supabase_migration_v11_secure_analytics_views.sql](file:///c:/Users/rafox/OneDrive/Documentos/07%20Lista%20de%20tarefas/supabase_migration_v11_secure_analytics_views.sql)) executam:
```sql
REVOKE SELECT ON public.vw_mrr_metrics FROM anon, authenticated, public;
GRANT SELECT ON public.vw_mrr_metrics TO service_role;
```
O script `checkSchemaDrift.js` utiliza a chave anônima pública (`VITE_SUPABASE_ANON_KEY`), resultando em erro de permissão (excluindo a view do cache REST público). Isso gera o falso positivo "MISSING".

---

## 4. PLANO DE AÇÃO E CORREÇÃO
1.  **Modificar o Drift Checker:** Atualizar `checkSchemaDrift.js` para realizar consultas de integridade estrutural usando a `service_role` (que possui privilégios totais) ou ignorar falhas de permissão de leitura anônima para recursos de analytics restritos a administradores.
2.  **Aplicar Migração Pendente:** Executar o script da tabela `feedback` ([supabase_migration_v8_feedback.sql](file:///c:/Users/rafox/OneDrive/Documentos/07%20Lista%20de%20tarefas/supabase_migration_v8_feedback.sql)) no SQL Editor do Supabase de produção para sanar o erro de salvamento de feedback.
3.  **Habilitar Growth OS (Opcional):** Executar [supabase_migration_v28_growth_os.sql](file:///c:/Users/rafox/OneDrive/Documentos/07%20Lista%20de%20tarefas/supabase_migration_v28_growth_os.sql) para ativar a rastreabilidade de risco de cancelamento.
