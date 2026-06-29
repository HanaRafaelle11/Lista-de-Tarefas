# CORRECTIONS SUMMARY REPORT (CORRECTIONS_SUMMARY)
**Produto:** Flowday 3.0  
**Data da Auditoria:** 2026-06-29  
**Status das Correções:** 🟡 AGUARDANDO EXECUÇÃO DE BANCO (1 Aplicada no Código, 2 Pendentes em Banco)

---

## 1. OBJETIVO
Compilar todas as correções necessárias e detalhar os passos que o administrador do banco de dados deve executar para estabilizar o Flowday 3.0 antes da liberação final.

---

## 2. CORREÇÕES DE CÓDIGO EFETUADAS (PRONTAS)

### A. Correção da Suíte de Testes de Billing ([runBillingTests.js])
*   **Problema:** O teste do cenário `Timeout` falhava impossibilitando a validação automatizada pré-deploy.
*   **Ação:** Corrigido o caminho de importação do `DistributedLock`:
    ```diff
    - const { DistributedLock } = await import('../api/distributed-lock.js');
    + const { DistributedLock } = await import('../services/distributed-lock.js');
    ```
*   **Resultado:** Suíte executada com **13/13 testes aprovados**.

---

## 3. CORREÇÕES DE BANCO DE DADOS EXIGIDAS (PENDENTES)

Para sanar os drifts de schema detectados, o administrador deve copiar e rodar os seguintes comandos SQL no **SQL Editor do Supabase**:

### Passo 1 — Criar Tabela de Feedback (Sanar BUG #1)
Este script ativa o salvamento físico de feedbacks enviados pelos usuários:
```sql
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anyone to insert feedback" ON public.feedback;
CREATE POLICY "Allow anyone to insert feedback" 
  ON public.feedback FOR INSERT 
  TO authenticated, anon 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admins to read all feedback" ON public.feedback;
CREATE POLICY "Allow admins to read all feedback" 
  ON public.feedback FOR SELECT 
  TO authenticated 
  USING (
    (auth.jwt()->>'email' = 'admin@flowday.app') OR 
    (auth.jwt()->>'email' = 'rafaelle@flowday.app') OR 
    (auth.jwt()->>'email' = 'rafox@flowday.app')
  );

COMMENT ON TABLE public.feedback IS 'Feedback submitted by Flowday users';
```

### Passo 2 — Criar Tabelas do Growth OS (Sanar BUG #2 - Opcional)
Este script ativa a infraestrutura de prevenção de cancelamentos e análise de risco do usuário:
```sql
CREATE TABLE IF NOT EXISTS public.user_risk_profile (
  user_id UUID PRIMARY KEY,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  reason_summary TEXT,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.revenue_leaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  leak_type TEXT NOT NULL,
  estimated_value_loss NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.growth_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  triggered_by_event TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.growth_action_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.growth_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_returned BOOLEAN NOT NULL DEFAULT false,
  payment_recovered BOOLEAN NOT NULL DEFAULT false,
  engagement_increased BOOLEAN NOT NULL DEFAULT false,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_risk_level ON public.user_risk_profile(risk_level);
CREATE INDEX IF NOT EXISTS idx_revenue_leaks_user ON public.revenue_leaks(user_id);
CREATE INDEX IF NOT EXISTS idx_growth_actions_status ON public.growth_actions(status);
CREATE INDEX IF NOT EXISTS idx_growth_action_results_action ON public.growth_action_results(action_id);

ALTER TABLE public.user_risk_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_leaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_action_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access on user_risk_profile" ON public.user_risk_profile;
CREATE POLICY "Allow service role full access on user_risk_profile" ON public.user_risk_profile FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Allow service role full access on revenue_leaks" ON public.revenue_leaks;
CREATE POLICY "Allow service role full access on revenue_leaks" ON public.revenue_leaks FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Allow service role full access on growth_actions" ON public.growth_actions;
CREATE POLICY "Allow service role full access on growth_actions" ON public.growth_actions FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Allow service role full access on growth_action_results" ON public.growth_action_results;
CREATE POLICY "Allow service role full access on growth_action_results" ON public.growth_action_results FOR ALL TO service_role USING (true);
```

### Passo 3 — Atualizar Cache do PostgREST
Após rodar os SQLs acima, execute a recarga do cache de schemas para expor as novas tabelas à API REST do Supabase:
```sql
NOTIFY pgrst, 'reload schema';
```
