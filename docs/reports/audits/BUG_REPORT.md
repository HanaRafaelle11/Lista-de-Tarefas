# REMAINING BUG REPORT (BUG_REPORT)
**Produto:** Flowday 3.0  
**Data da Auditoria:** 2026-06-29  
**Status dos Bugs:** 🟡 DETECTADOS (1 Corrigido, 3 Pendentes)

---

## 1. OBJETIVO
Listar todos os problemas restantes, desvios e erros descobertos durante as fases da Launch Certification que impedem o status ideal de prontidão para lançamento.

---

## 2. LISTA DE BUGS REMANESCENTES (BLOQUEANTES E NÃO-BLOQUEANTES)

### BUG #1 — Tabela `feedback` Inexistente no Banco de Produção
*   **Prioridade:** P1 (Crítico)
*   **Descrição:** A tabela `feedback` não foi criada no banco de dados remoto Supabase de produção.
*   **Impacto:** Quebra silenciosa do envio de feedbacks dos usuários ([SettingsView.jsx]). O app cai no fallback local, mas os feedbacks não são salvos em banco e são perdidos para o time de produto.
*   **Resolução Exigida:** Executar o script [supabase_migration_v8_feedback.sql] no SQL Editor do Supabase de produção.

### BUG #2 — Tabelas Opcionais do Growth OS Inexistentes no Banco
*   **Prioridade:** P2 (Média)
*   **Descrição:** As tabelas `user_risk_profile`, `revenue_leaks`, `growth_actions` e `growth_action_results` estão ausentes no Supabase.
*   **Impacto:** O Worker Loop do backend reporta aviso nos logs (`Tabela user_risk_profile ausente.`) e o Growth OS OS Engine permanece inativo, desabilitando a recuperação autônoma de usuários.
*   **Resolução Exigida:** Executar o script [supabase_migration_v28_growth_os.sql] no SQL Editor do Supabase.

### BUG #3 — Falso Positivo de Drift de Schema nas Analytics Views
*   **Prioridade:** P3 (Menor)
*   **Descrição:** O script `checkSchemaDrift.js` indica erro de drift ("MISSING") para as visões analíticas (`vw_mrr_metrics`, etc.), embora elas existam e funcionem para o backend.
*   **Impacto:** Confusão de auditoria e falha falsa na verificação de integridade estrutural.
*   **Causa Raiz:** O script de teste faz queries usando a chave anônima (`VITE_SUPABASE_ANON_KEY`), mas essas visões são protegidas com privilégios restritos apenas para `service_role` (segurança de dados).
*   **Resolução Exigida:** Atualizar o script `checkSchemaDrift.js` para usar `SUPABASE_SERVICE_ROLE_KEY` na checagem destas visões específicas ou ignorar erros do tipo PGRST204 de permissão de leitura.

---

## 3. BUGS ENCONTRADOS E CORRIGIDOS DURANTE ESTA CERTIFICAÇÃO

### BUG #4 — Caminho Incorreto de Importação em `runBillingTests.js` (CORRIGIDO)
*   **Prioridade:** P1 (Crítico)
*   **Descrição:** O script de teste de faturamento falhava no cenário `Timeout` devido ao import inexistente de `../api/distributed-lock.js`.
*   **Correção Aplicada:** O import foi alterado para `../services/distributed-lock.js`, reestabelecendo a suíte de testes de faturamento para **100% de sucesso (13/13)**.
