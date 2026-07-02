# Relatório de Auditoria de Produção (MyFlowDay SaaS)

Este relatório consolida a auditoria final de produção realizada no MyFlowDay, cobrindo segurança de credenciais, agendamento em segundo plano (`pg_cron`/`pg_net`), lock de concorrência, idempotência e integridade do repositório.

---

## 1. Problemas Identificados e Corrigidos

### A. Credenciais JWT Hardcoded (CRÍTICO)
* **Problema**: A `service_role` master JWT do Supabase estava escrita em texto puro (hardcoded) nas migrações SQL e nos agendamentos de segundo plano do `pg_cron`. Isso geraria graves problemas de vazamento de segredos administrativos no repositório Git.
* **Correção**: Removemos completamente qualquer token JWT dos arquivos de migração e do script `supabase_cron_setup_instructions.sql`. Habilitamos a integração do agendador com a extensão de segurança `supabase_vault`. Agora, o `pg_cron` injeta o cabeçalho Bearer dinamicamente direto da view Postgres `vault.decrypted_secrets` via subquery:
  ```sql
  Authorization := (SELECT 'Bearer ' || decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' OR name ILIKE '%service_role%' LIMIT 1)
  ```
  Isso mantém o repositório 100% limpo e compatível com rotações de chaves.

### B. Limitação de Cron na Vercel Hobby (CRÍTICO)
* **Problema**: O cron configurado no arquivo `vercel.json` rodava a cada minuto, o que violava os termos do plano gratuito (Hobby) da Vercel, impedindo o deploy do app por completo.
* **Correção**: Removemos totalmente a propriedade `"crons"` do arquivo `vercel.json`, destravando o pipeline de deploy automático da Vercel. Migramos toda a lógica de disparos periódicos para os cron jobs nativos do banco de dados (`pg_cron`).

### C. Vulnerabilidade a Falhas e Travamento da Fila (ALTO)
* **Problema**: Se o worker do Deno ou o processador de notificações sofresse uma queda física, queda de rede ou timeout durante a execução da Edge Function, o registro permaneceria permanentemente no status `'processing'`, travando futuras tentativas.
* **Correção**: Implementamos uma rotina de recuperação atômica (*self-healing*) dentro da procedure `claim_pending_notifications`. Antes de iniciar cada lote, a query redefine automaticamente para `'pending'` qualquer registro travado no status `'processing'` por mais de 15 minutos, assegurando que o app se recupere sozinho de instabilidades.

---

## 2. Análise de Arquitetura e Validação de Fluxos

### Lock de Concorrência
Validamos a procedure `claim_pending_notifications` no banco de dados. Ela executa um lock pessimista via `FOR UPDATE SKIP LOCKED` em nível de linha:
* Se duas instâncias do cron rodarem ao mesmo tempo, cada uma bloqueará e processará um subconjunto de linhas diferente.
* Linhas em processamento são ignoradas por outros workers e liberadas instantaneamente, zerando o risco de race conditions.

### Idempotência
A idempotência é garantida em múltiplos níveis:
* **Fila do Postgres**: O status da notificação é transicionado para `'processing'` em uma transação atômica logo ao ser capturado pelo worker, bloqueando disparos concorrentes.
* **Assinatura Base/Web Push**: Cada disparo carrega um payload JSON contendo o UUID da notificação original na propriedade `tag`/`idempotency_key`. O Service Worker e o serviço do FCM descartam mensagens com tags duplicadas que chegam no mesmo intervalo, evitando que o dispositivo toque duas vezes para o mesmo compromisso.

---

## 3. Auditoria Geral do Repositório (Checks Rápidos)

* **Segredos expostos**: Nenhum segredo do Stripe, MercadoPago ou chaves VAPID privadas foi encontrado exposto no repositório. Arquivo `.env.local` devidamente listado no `.gitignore`.
* **URLs incorretas / localhost restante**: Todas as URLs são carregadas dinamicamente via variáveis de ambiente. As referências internas ao `localhost` no frontend são tratadas como fallbacks para ambiente de desenvolvimento local (Warnings dinâmicos).
* **TODO / FIXME**: Localizado um único TODO de legabilidade em `src/services/goalsService.js` (referente a uma camada de compatibilidade deprecada da Fase 1, inofensivo para produção).
* **console.log**: Logs do frontend estão normais. O Service Worker e o backend possuem loggers estruturados que ajudam na telemetria.
* **Migrations / Jobs duplicados**: Migrações organizadas sequencialmente por timestamp. Sem duplicidade de schemas ou tabelas.
* **Edge Functions não utilizadas**: As 3 Edge Functions da pasta `supabase/functions/` (`push`, `process-events` e `process-notification-queue`) estão ativas e integradas ao agendamento nativo do pg_cron.

---

## 4. Checklist de Lançamento em Produção

* `[x]` Chaves JWT e credenciais admin removidas de todos os códigos e migrações.
* `[x]` Cron da Vercel Hobby removido do `vercel.json` para liberar a esteira de deploy.
* `[x]` Migração do `pg_cron` e `pg_net` configurada com chamadas autenticadas dinâmicas.
* `[x]` Mecanismo de recuperação automática (*self-healing*) de jobs travados ativo.
* `[ ]` Executar o agendador e a RPC de diagnóstico no SQL Editor do painel Supabase.
* `[ ]` Injetar as chaves VAPID do frontend nos segredos de produção das Edge Functions usando a CLI:
  ```bash
  supabase secrets set --project-ref mftsklhrzhhvtsuamqaw VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..."
  ```
