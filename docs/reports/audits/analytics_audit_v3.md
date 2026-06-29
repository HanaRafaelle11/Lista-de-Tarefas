# Auditoria de Analytics e Segurança — Flowday V3 (Produção)

Este documento descreve os problemas identificados, seu impacto, prioridade e as soluções técnicas definitivas aplicadas para garantir segurança, escalabilidade e qualidade no Flowday.

---

## 1. Segurança e Privacidade (Supabase)

### 1.1. Dependência de Metadados do Auth (`is_pro`)
*   **Problema:** O status Pro do usuário era verificado a partir de `raw_user_meta_data->>'is_pro'`, que pode ser alterado no cliente ou adulterado, não servindo como fonte de verdade auditável.
*   **Impacto:** Risco de evasão de receita (usuários ativando recursos Pro gratuitamente via API do cliente).
*   **Prioridade:** Crítica (Alta).
*   **Solução Aplicada:** Criada a tabela `public.subscriptions` com políticas RLS para leitura própria e verificação de administradores. O status Pro passa a ser obtido diretamente dessa tabela via consulta SQL no login.

### 1.2. Exposição de E-mails em Funções `SECURITY DEFINER`
*   **Problema:** As funções `get_admin_dashboard_metrics` e `get_user_detail_metrics` podiam ser executadas por qualquer usuário conectado, vazando e-mails e timelines de uso.
*   **Impacto:** Vazamento de dados pessoais (LGPD).
*   **Prioridade:** Crítica (Alta).
*   **Solução Aplicada:** Privilégios de execução pública revogados (`REVOKE EXECUTE ON FUNCTION FROM public`). Adicionada verificação no início do PL/pgSQL comparando o email no JWT (`auth.jwt()->>'email'`) com a lista de administradores, levantando exceções de acesso negado.

---

## 2. Rastreamento e Confiabilidade dos Eventos (`eventBatcher`)

### 2.1. Condição de Corrida no Envio de Lotes
*   **Problema:** O timer recorrente (15s) e o limite de itens (15) no batcher podiam disparar chamadas assíncronas concorrentes para a API do Supabase.
*   **Impacto:** Duplicação de eventos, requisições sobrepostas e inconsistência nas chaves primárias.
*   **Prioridade:** Alta.
*   **Solução Aplicada:** Adicionada uma trava de controle de estado `isFlushing`. Se um envio estiver ativo, novos disparos são imediatamente ignorados.

### 2.2. Perda de Eventos no Fechamento da Página
*   **Problema:** Eventos parados em memória quando o usuário fecha a aba ou recarrega a página eram perdidos.
*   **Impacto:** Subnotificação de eventos de encerramento de sessão, abandono de onboarding e de metas concluídas.
*   **Prioridade:** Alta.
*   **Solução Aplicada:** Ouvintes de `visibilitychange` (quando ocultado) e `pagehide` adicionados para disparar requisições `fetch` com a flag `keepalive: true` contendo o cabeçalho de autorização.

### 2.3. Fluxo Inseguro de Deleção Local (Delete-Before-Confirm)
*   **Problema:** Os eventos eram apagados do IndexedDB local imediatamente antes de serem enviados à API do Supabase.
*   **Impacto:** Se o envio falhasse ou a rede caísse durante a requisição, os eventos eram perdidos para sempre.
*   **Prioridade:** Alta.
*   **Solução Aplicada:** Refatorado para o fluxo **Confirm-then-Delete**. Os eventos são copiados, a fila limpa, enviados via upsert e, somente após a confirmação HTTP positiva da API, os itens são removidos do IndexedDB. Se a requisição falhar, os eventos retornam à fila para reenvio.

---

## 3. Qualidade de Dados e Métricas (Single Source of Truth)

### 3.1. Agregações Locais no Navegador (Admin Dashboard)
*   **Problema:** Se as RPCs falhassem, o frontend realizava queries agregadas sequenciais complexas no cliente (HEAD counts, etc.) para calcular MRR, Churn, Stickiness e Ativação.
*   **Impacto:** Lentidão na interface, inconsistência entre o que o admin vê na tela e as métricas reais do banco.
*   **Prioridade:** Média-Alta.
*   **Solução Aplicada:** Removidos todos os fallbacks do cliente. A RPC do banco é a única fonte de verdade. Em caso de falha, um banner de erro de banco é renderizado.

### 3.2. Ruído de Eventos de Visualização
*   **Problema:** Eventos como `home_viewed`, `tasks_viewed` e `settings_viewed` poluíam a tabela de eventos como registros separados.
*   **Impacto:** Alto consumo de armazenamento e dificuldade na mineração de dados.
*   **Prioridade:** Média.
*   **Solução Aplicada:** Consolidado em um único tipo de evento `screen_view` contendo o metadado `{ screen: "nome_da_tela" }`.

---

## 4. Banco de Dados e Performance (Supabase Scale)

### 4.1. Múltiplas Varreduras na Tabela de Eventos
*   **Problema:** A função `get_admin_dashboard_metrics` original realizava 13 comandos `SELECT COUNT(*)` independentes na tabela `events`.
*   **Impacto:** Sobrecarga de I/O de disco e alto tempo de resposta (segundos) sob milhões de eventos.
*   **Prioridade:** Alta.
*   **Solução Aplicada:** Otimizado o escopo para um único comando `SELECT` consolidado com cláusulas condicionais `FILTER (WHERE event_type = '...')`, reduzindo a carga do banco a uma única leitura rápida.

### 4.2. Falta de Estrutura de Pré-Processamento (Materialized Views)
*   **Problema:** Cálculos de usuários ativos diários, semanais e retenções eram processados em tempo real na tabela de eventos brutos.
*   **Impacto:** Lentidão severa no dashboard conforme a base de usuários cresce.
*   **Prioridade:** Média-Alta.
*   **Solução Aplicada:** Criadas 5 visões materializadas (`mv_active_users_daily`, `mv_active_users_weekly`, `mv_active_users_monthly`, `mv_retention_metrics`, `mv_monetization_metrics`) com índices exclusivos para possibilitar atualizações concorrentes não-bloqueantes.
