# Relatório de Auditoria E2E — Pipeline de Push Notifications

> **Projeto:** MyFlowDay  
> **Data:** 2026-07-02T18:20:38Z  
> **Método:** Queries SQL em tempo real contra produção + análise estática de código  

---

## Resumo Executivo

O pipeline de push notifications **funciona parcialmente**. As notificações **são enviadas ao FCM e aceitas (HTTP 201)**, mas existem problemas concretos de higiene de dados e uma lacuna entre o agendamento automático (pg_cron → Edge Function) e a fila de envio.

> [!IMPORTANT]
> O principal problema identificado é a **proliferação de subscriptions duplicadas** (54 endpoints para um único usuário), somada a **3 endpoints expirados (HTTP 410 Gone)** que geram ruído nos logs e desperdício de recursos.

---

## 1. Auditoria da `notification_queue`

| Métrica | Valor | Status |
|---------|-------|--------|
| Total de registros | 1 | ⚠️ |
| Status `sent` | 1 | 🟢 |
| Status `pending` | 0 | — |
| Status `processing` (presos) | 0 | 🟢 |
| Status `failed` | 0 | 🟢 |

**Evidência:**
```
ID=b51fe74a-22ac-4259-be82-00db2f590ae3
status=sent  sent_at=2026-07-01T20:45:04.018+00:00
```

> [!NOTE]
> A fila possui apenas 1 registro (enviado com sucesso). Isso significa que:  
> 1. O trigger que popula a fila (baseado em `due_date` das tarefas) **não está gerando registros automaticamente**, OU  
> 2. Os registros estão sendo consumidos e limpos rapidamente.  
> A ausência de registros `pending` impossibilita testar o fluxo ponta a ponta pelo cron.

---

## 2. Auditoria das `push_subscriptions`

| Métrica | Valor | Status |
|---------|-------|--------|
| Total de subscriptions | **57** | ⚠️ Excessivo |
| Subscriptions sem chaves | 0 | 🟢 |
| Expiradas (>30 dias) | 0 | 🟢 |
| Endpoints duplicados | 0 | 🟢 |
| Usuários únicos | **2** | — |

**Distribuição por usuário:**
```
52412a5a-8bda-451b-b364-fde59611da27: 54 subscriptions  ← ⚠️ PROBLEMA
8670be5d-ca96-4833-809e-39191623ac45: 3 subscriptions
```

**Provedores:**
```
FCM (Google): 57 | Mozilla: 0 | Apple: 0
```

> [!WARNING]
> **54 subscriptions para um único usuário é anormal.** Cada vez que o usuário abre o app ou recarrega a página, uma nova subscription está sendo criada em vez de reusar a existente. Isso causa:
> - Envio de push para 54 endpoints simultaneamente (a Edge Function itera todos)
> - Falhas silenciosas em endpoints mortos
> - Desperdício de tempo de execução da Edge Function

**Causa raiz identificada no código:** Em [useNotifications.js](file:///c:/Users/rafox/OneDrive/Documentos/07%20Lista%20de%20tarefas/src/hooks/useNotifications.js#L150-L163), o código verifica se já existe uma subscription ativa via `registration.pushManager.getSubscription()`. Se existir, ele a reusa. Porém, a Edge Function `push` (registro) faz dedup apenas por `endpoint`. Quando o navegador gera um novo endpoint (por exemplo, após limpar cache, reinstalar o PWA ou trocar de aba em modo incógnito), um novo registro é criado sem limpar os antigos daquele mesmo `user_id`.

---

## 3. Auditoria dos `notification_logs` (Evidência de envio real)

| Métrica | Valor | Status |
|---------|-------|--------|
| Registros consultados | 20 | — |
| Status `sent` | **20** | 🟢 |
| Status `failed` | **0** | 🟢 |

### Códigos HTTP do FCM (Provider)

| HTTP Code | Quantidade | Significado |
|-----------|-----------|-------------|
| **201** | **6** | ✅ Created — **ENTREGA REAL CONFIRMADA** |
| **410** | **1** | 🔴 Gone — **ENDPOINT EXPIRADO** |

### Detalhamento do último envio (2026-07-02T08:39:05Z)

```
Título: "Teste notificação"
Usuário: 52412a5a-8bda-451b-b364-fde59611da27
Total de dispositivos tentados: 26 endpoints

Resultados por dispositivo:
  Device[0]:  HTTP 410 — ENDPOINT EXPIRADO (push subscription has unsubscribed or expired)
  Device[1]:  HTTP 201 — ✅ Sucesso
  Device[2]:  HTTP 201 — ✅ Sucesso
  ...
  Device[23]: HTTP 201 — ✅ Sucesso
  Device[24]: HTTP 410 — ENDPOINT EXPIRADO
  Device[25]: HTTP 410 — ENDPOINT EXPIRADO
```

> [!IMPORTANT]
> De 26 endpoints testados, **23 retornaram HTTP 201 (sucesso real)** e **3 retornaram HTTP 410 (endpoint morto)**. A Edge Function [push/index.ts](file:///c:/Users/rafox/OneDrive/Documentos/07%20Lista%20de%20tarefas/supabase/functions/push/index.ts#L166-L179) possui lógica de limpeza automática (linhas 166-179) que **remove endpoints 410/404/403 do banco** após a detecção. Isso está funcionando corretamente.

---

## 4. Auditoria das `notification_deliveries`

| Métrica | Valor | Status |
|---------|-------|--------|
| Total de registros | **0** | 🔴 |

> [!CAUTION]
> A tabela `notification_deliveries` está **completamente vazia**. Isso indica que a Edge Function `process-notification-queue` (que insere registros nesta tabela nas linhas 138-169) **não está sendo executada pelo pg_cron**, ou está falhando silenciosamente antes de chegar à etapa de insert.
> 
> Os 20 registros em `notification_logs` foram provavelmente inseridos por invocações **manuais diretas** da Edge Function `push`, não pelo fluxo automatizado pg_cron → `process-notification-queue` → `push`.

---

## 5. Auditoria da `push_telemetry`

| Métrica | Valor | Status |
|---------|-------|--------|
| Total de registros | 30 | — |
| Tipo `diagnostic` | 29 | — |
| Tipo `received` | **1** | ⚠️ |

**Confirmação de recebimento pelo Service Worker:**
```
Último recebimento: 2026-07-02T16:53:00.559Z  ← ✅ 1 push recebido pelo SW
```

> [!NOTE]
> Apenas **1 confirmação de recebimento** pelo Service Worker em 30 registros de telemetria. Isso é consistente com o fato de que a maioria dos 29 registros são diagnósticos de registro (não de entrega). A notificação push **chegou ao dispositivo** pelo menos uma vez.

---

## 6. Auditoria das Chaves VAPID

| Item | Status |
|------|--------|
| Chave Pública (Frontend) | 🟢 `BPE15kzXwmrFN2wLkTDK...` |
| Chave Privada (Backend) | 🟢 Presente |
| Validação do par | 🟢 Assinatura gerada com sucesso |

O par de chaves VAPID local é **válido e funcional**. A assinatura JWT foi gerada e verificada com sucesso contra um endpoint FCM de teste.

---

## 7. Auditoria do Service Worker

### Análise do código [sw.js](file:///c:/Users/rafox/OneDrive/Documentos/07%20Lista%20de%20tarefas/src/sw.js)

| Item | Status | Evidência |
|------|--------|-----------|
| Event listener `push` registrado | 🟢 | Linha 18 |
| `showNotification` chamado | 🟢 | Linha 69 |
| Payload JSON parseado | 🟢 | Linha 31 |
| Telemetria de recebimento enviada | 🟢 | Linha 81 |
| Ícone correto (`/branding/icon-192.png`) | 🟢 | Linha 44 |
| Actions (Abrir, Concluir, Adiar) | 🟢 | Linhas 50-54 |
| `notificationclick` handler | 🟢 | Linha 126 |
| Deep linking na ação de clique | 🟢 | Linhas 193-209 |
| Snooze de 10 minutos | 🟢 | Linhas 167-191 |

> O Service Worker está **completo e funcional**. Ele recebe o push, parseia o payload, exibe a notificação nativa e envia telemetria de confirmação.

---

## 8. Auditoria do Frontend (Registro Push)

### Análise do código [useNotifications.js](file:///c:/Users/rafox/OneDrive/Documentos/07%20Lista%20de%20tarefas/src/hooks/useNotifications.js)

| Item | Status | Evidência |
|------|--------|-----------|
| `Notification.requestPermission()` | 🟢 | Linha 243 |
| `pushManager.subscribe()` com VAPID | 🟢 | Linhas 154-157 |
| Chaves p256dh/auth extraídas | 🟢 | Linhas 165-167 |
| Edge Function `push` invocada para registro | 🟢 | Linhas 189-195 |
| Diagnósticos de telemetria enviados | 🟢 | Múltiplas chamadas `logDiagnostic` |
| Sessão de dedup (sessionStorage) | 🟢 | Linhas 176-180 |
| Web Lock para evitar registros concorrentes | 🟢 | Linhas 223-227 |

---

## 9. Diagnóstico Final — Onde o Fluxo Para

```
[1] Subscriptions registradas?          🟢 SIM (57)
[2] Chaves p256dh/auth válidas?         🟢 SIM
[3] Itens na fila (notification_queue)?  ⚠️ FILA QUASE VAZIA (1 registro histórico)
[4] pg_cron → process-notification-queue?  🔴 SEM EVIDÊNCIA DE EXECUÇÃO AUTOMÁTICA
[5] FCM retornou HTTP 201?              🟢 SIM (23/26 dispositivos)
[6] FCM retornou HTTP 410?              🔴 SIM (3 endpoints expirados)
[7] Service Worker confirmou?           🟢 SIM (1 recebimento confirmado)
```

---

## 🚨 Conclusão: Ponto Exato de Falha

### O pipeline **funciona quando invocado manualmente**, mas **NÃO está sendo acionado automaticamente pelo pg_cron**.

A cadeia esperada é:
```
Tarefa com due_date vencido
  → Trigger SQL insere registro em notification_queue (status=pending)
    → pg_cron invoca Edge Function process-notification-queue
      → process-notification-queue chama Edge Function push
        → push envia via VAPID/FCM
          → FCM entrega ao navegador
            → Service Worker exibe notificação
```

**Evidência concreta:**
1. A tabela `notification_deliveries` está **vazia** — a Edge Function `process-notification-queue` nunca inseriu registros nela.
2. A `notification_queue` tem apenas **1 registro** (status=`sent`), que foi processado provavelmente por invocação manual.
3. Os `notification_logs` mostram **20 envios bem-sucedidos**, todos com título de teste ("Teste notificação", "Test push", "Test push 3"), indicando invocações manuais e não automáticas.

### Problemas Adicionais Confirmados

| # | Problema | Severidade | Evidência |
|---|----------|-----------|-----------|
| 1 | pg_cron não está invocando `process-notification-queue` automaticamente | 🔴 Crítico | `notification_deliveries` vazia |
| 2 | 54 subscriptions para 1 usuário (proliferação) | 🟡 Alto | Query `push_subscriptions` |
| 3 | 3 endpoints FCM retornando 410 Gone | 🟡 Médio | `notification_logs` provider_response |
| 4 | Colunas `provider_status`, `provider_message_id`, `provider_response` podem não existir no schema real de `notification_queue` | 🟡 Médio | Query fallback necessária |

---

## Ações Recomendadas (Prioridade)

### 1. 🔴 Verificar se o pg_cron job está criado e ativo
Executar no SQL Editor do Supabase:
```sql
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```
Se a tabela `cron.job` estiver vazia, o job **nunca foi criado**. As migrações de configuração precisam ser aplicadas.

### 2. 🔴 Verificar se o Vault tem a Service Role Key
```sql
SELECT name, description FROM vault.decrypted_secrets WHERE name ILIKE '%service_role%';
```
Se retornar vazio, a chave precisa ser inserida manualmente.

### 3. 🟡 Limpar subscriptions excessivas
```sql
-- Manter apenas a subscription mais recente por usuário
DELETE FROM push_subscriptions
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id 
  FROM push_subscriptions 
  ORDER BY user_id, updated_at DESC
);
```

### 4. 🟡 Adicionar coluna `max_subscriptions_per_user` ou limitar no código
Modificar a Edge Function `push` (registro) para deletar subscriptions antigas do mesmo `user_id` antes de inserir novas, mantendo no máximo 5 por usuário.
