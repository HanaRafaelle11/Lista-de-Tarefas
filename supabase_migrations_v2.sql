-- supabase_migrations_v2.sql
-- Migration file for Flowday V2: Scalability Indexes, Views, Subscriptions Table and Hardened RPC Functions

-- 1. Create Subscriptions Table (Audit Trail of Pro status)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'active', 'canceled'
  plan TEXT DEFAULT 'pro',
  price NUMERIC DEFAULT 29.90,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscriptions RLS Policies
DROP POLICY IF EXISTS "Allow users to read own subscription" ON public.subscriptions;
CREATE POLICY "Allow users to read own subscription" 
ON public.subscriptions FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to insert own subscription" ON public.subscriptions;
CREATE POLICY "Allow users to insert own subscription" 
ON public.subscriptions FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to update own subscription" ON public.subscriptions;
CREATE POLICY "Allow users to update own subscription" 
ON public.subscriptions FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow admins to read all subscriptions" ON public.subscriptions;
CREATE POLICY "Allow admins to read all subscriptions" 
ON public.subscriptions FOR SELECT 
TO authenticated 
USING (
  (auth.jwt()->>'email' = 'admin@flowday.app') OR 
  (auth.jwt()->>'email' = 'rafaelle@flowday.app') OR 
  (auth.jwt()->>'email' = 'rafox@flowday.app')
);

-- 2. Create Performance Indexes for events table
CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id_created_at ON public.events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_event_type_created_at ON public.events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- 3. Create RPC Function to calculate Admin Dashboard Metrics (SaaS Analytics V2)
-- Revoked execute rights from public, only granted to authenticated, and explicitly verified in PL/pgSQL
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_email text;
  
  v_total_users bigint;
  v_active_today bigint;
  v_active_7d bigint;
  v_active_30d bigint;
  
  v_goal_created bigint;
  v_goal_completed bigint;
  v_task_created bigint;
  v_task_completed bigint;
  v_activation_rate numeric;
  
  v_retention_d1 numeric;
  v_retention_d7 numeric;
  v_retention_d30 numeric;
  
  v_dau bigint;
  v_wau bigint;
  v_mau bigint;
  v_stickiness_dau_mau numeric;
  v_stickiness_dau_wau numeric;
  
  v_focus_completed bigint;
  v_weekly_plans bigint;
  v_calendar_tasks bigint;
  v_habits_completed bigint;
  
  v_paywall_views bigint;
  v_upgrade_clicks bigint;
  v_monetization_conversion numeric;
  v_pro_count bigint;
  v_mrr numeric;
  v_arr numeric;
  v_churn numeric;
  
  v_total_subs bigint;
  v_canceled_subs bigint;
  
  v_result json;
BEGIN
  -- Strict Admin Verification Check (Security Hardening)
  v_caller_email := auth.jwt()->>'email';
  IF v_caller_email NOT IN ('admin@flowday.app', 'rafaelle@flowday.app', 'rafox@flowday.app') OR v_caller_email IS NULL THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem executar esta função.' USING ERRCODE = '42501';
  END IF;

  -- Count total users from profiles
  SELECT COUNT(*) INTO v_total_users FROM public.profiles;
  
  -- Single-scan conditional aggregations on public.events (Scalability Optimization)
  SELECT
    COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day'),
    COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'),
    COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'),
    COUNT(*) FILTER (WHERE event_type = 'goal_created'),
    COUNT(*) FILTER (WHERE event_type = 'goal_completed'),
    COUNT(*) FILTER (WHERE event_type = 'task_created'),
    COUNT(*) FILTER (WHERE event_type = 'task_completed'),
    COUNT(*) FILTER (WHERE event_type = 'focus_session_completed'),
    COUNT(*) FILTER (WHERE event_type = 'weekly_plan_completed'),
    COUNT(*) FILTER (WHERE event_type = 'calendar_task_completed'),
    COUNT(*) FILTER (WHERE event_type = 'habit_completed'),
    COUNT(*) FILTER (WHERE event_type = 'paywall_viewed'),
    COUNT(*) FILTER (WHERE event_type = 'upgrade_clicked')
  INTO
    v_active_today,
    v_active_7d,
    v_active_30d,
    v_goal_created,
    v_goal_completed,
    v_task_created,
    v_task_completed,
    v_focus_completed,
    v_weekly_plans,
    v_calendar_tasks,
    v_habits_completed,
    v_paywall_views,
    v_upgrade_clicks
  FROM public.events;
  
  -- Activation Rate: users who completed at least 1 task
  SELECT 
    CASE 
      WHEN COUNT(DISTINCT p.id) = 0 THEN 0
      ELSE ROUND((COUNT(DISTINCT e.user_id)::numeric / COUNT(DISTINCT p.id)::numeric) * 100, 1)
    END INTO v_activation_rate
  FROM public.profiles p
  LEFT JOIN public.events e ON p.id = e.user_id AND e.event_type = 'task_completed';

  -- Active user metrics for stickiness
  v_dau := v_active_today;
  v_wau := v_active_7d;
  v_mau := v_active_30d;
  
  IF v_mau > 0 THEN
    v_stickiness_dau_mau := ROUND((v_dau::numeric / v_mau::numeric) * 100, 1);
  ELSE
    v_stickiness_dau_mau := 0;
  END IF;
  
  IF v_wau > 0 THEN
    v_stickiness_dau_wau := ROUND((v_dau::numeric / v_wau::numeric) * 100, 1);
  ELSE
    v_stickiness_dau_wau := 0;
  END IF;

  -- Pro users count (from subscriptions table)
  SELECT COUNT(DISTINCT user_id) INTO v_pro_count 
  FROM public.subscriptions 
  WHERE status = 'active';
  
  -- MRR / ARR from actual subscriptions prices
  SELECT COALESCE(SUM(price), 0.0) INTO v_mrr 
  FROM public.subscriptions 
  WHERE status = 'active';
  v_arr := v_mrr * 12;

  -- Real Churn Rate calculation
  SELECT COUNT(*) INTO v_total_subs FROM public.subscriptions;
  SELECT COUNT(*) INTO v_canceled_subs FROM public.subscriptions WHERE status = 'canceled';
  
  IF v_total_subs > 0 THEN
    v_churn := ROUND((v_canceled_subs::numeric / v_total_subs::numeric) * 100, 1);
  ELSE
    v_churn := NULL; -- Return NULL as per instructions if not enough data
  END IF;

  IF v_paywall_views > 0 THEN
    v_monetization_conversion := ROUND((v_pro_count::numeric / v_paywall_views::numeric) * 100, 1);
  ELSE
    v_monetization_conversion := 0;
  END IF;

  -- Cohort retention D1, D7, D30 calculations (posterior to signup)
  -- D1: registered users who returned on Day 1 (24-48h later)
  SELECT 
    CASE 
      WHEN COUNT(DISTINCT p.id) = 0 THEN 0
      ELSE ROUND((COUNT(DISTINCT r.user_id)::numeric / COUNT(DISTINCT p.id)::numeric) * 100, 1)
    END INTO v_retention_d1
  FROM public.profiles p
  LEFT JOIN public.events r ON p.id = r.user_id 
    AND r.created_at >= p.created_at + INTERVAL '1 day' 
    AND r.created_at < p.created_at + INTERVAL '2 days'
    AND r.event_type NOT IN ('user_signed_up', 'signup_completed', 'signup')
  WHERE p.created_at <= NOW() - INTERVAL '1 day';

  -- D7: registered users who returned on Day 7 (day 7 to 8)
  SELECT 
    CASE 
      WHEN COUNT(DISTINCT p.id) = 0 THEN 0
      ELSE ROUND((COUNT(DISTINCT r.user_id)::numeric / COUNT(DISTINCT p.id)::numeric) * 100, 1)
    END INTO v_retention_d7
  FROM public.profiles p
  LEFT JOIN public.events r ON p.id = r.user_id 
    AND r.created_at >= p.created_at + INTERVAL '7 days' 
    AND r.created_at < p.created_at + INTERVAL '8 days'
    AND r.event_type NOT IN ('user_signed_up', 'signup_completed', 'signup')
  WHERE p.created_at <= NOW() - INTERVAL '7 days';

  -- D30: registered users who returned on Day 30 (day 30 to 31)
  SELECT 
    CASE 
      WHEN COUNT(DISTINCT p.id) = 0 THEN 0
      ELSE ROUND((COUNT(DISTINCT r.user_id)::numeric / COUNT(DISTINCT p.id)::numeric) * 100, 1)
    END INTO v_retention_d30
  FROM public.profiles p
  LEFT JOIN public.events r ON p.id = r.user_id 
    AND r.created_at >= p.created_at + INTERVAL '30 days' 
    AND r.created_at < p.created_at + INTERVAL '31 days'
    AND r.event_type NOT IN ('user_signed_up', 'signup_completed', 'signup')
  WHERE p.created_at <= NOW() - INTERVAL '30 days';

  -- Package result into JSON
  v_result := json_build_object(
    'total_users', COALESCE(v_total_users, 0),
    'active_today', COALESCE(v_active_today, 0),
    'active_7d', COALESCE(v_active_7d, 0),
    'active_30d', COALESCE(v_active_30d, 0),
    'goal_created', COALESCE(v_goal_created, 0),
    'goal_completed', COALESCE(v_goal_completed, 0),
    'task_created', COALESCE(v_task_created, 0),
    'task_completed', COALESCE(v_task_completed, 0),
    'activation_rate', COALESCE(v_activation_rate, 0.0),
    'retention_d1', COALESCE(v_retention_d1, 0.0),
    'retention_d7', COALESCE(v_retention_d7, 0.0),
    'retention_d30', COALESCE(v_retention_d30, 0.0),
    'stickiness_dau_mau', COALESCE(v_stickiness_dau_mau, 0.0),
    'stickiness_dau_wau', COALESCE(v_stickiness_dau_wau, 0.0),
    'focus_completed', COALESCE(v_focus_completed, 0),
    'weekly_plans', COALESCE(v_weekly_plans, 0),
    'calendar_tasks', COALESCE(v_calendar_tasks, 0),
    'habits_completed', COALESCE(v_habits_completed, 0),
    'paywall_views', COALESCE(v_paywall_views, 0),
    'upgrade_clicks', COALESCE(v_upgrade_clicks, 0),
    'monetization_conversion', COALESCE(v_monetization_conversion, 0.0),
    'mrr', v_mrr,
    'arr', v_arr,
    'churn', v_churn
  );

  RETURN v_result;
END;
$$;

-- 4. Create RPC Function to calculate Individual User Metrics (SaaS Analytics V2)
-- Revoked execute rights from public, only granted to authenticated, and explicitly verified in PL/pgSQL
CREATE OR REPLACE FUNCTION public.get_user_detail_metrics(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_email text;
  
  v_email text;
  v_created_at timestamptz;
  v_last_access timestamptz;
  v_active_days bigint;
  v_sessions bigint;
  v_goals_created bigint;
  v_goals_completed bigint;
  v_tasks_created bigint;
  v_tasks_completed bigint;
  v_pomodoros bigint;
  v_weekly_plans bigint;
  v_completion_rate numeric;
  v_result json;
BEGIN
  -- Strict Security Check: Only admins or the owner can query details
  v_caller_email := auth.jwt()->>'email';
  IF (v_caller_email NOT IN ('admin@flowday.app', 'rafaelle@flowday.app', 'rafox@flowday.app') OR v_caller_email IS NULL)
     AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Acesso negado. Não autorizado.' USING ERRCODE = '42501';
  END IF;

  -- Get user email and creation date from auth.users
  SELECT email, created_at INTO v_email, v_created_at FROM auth.users WHERE id = p_user_id;
  
  -- Single scan query on public.events for user metrics (Scalability Optimization)
  SELECT
    MAX(created_at),
    COUNT(DISTINCT created_at::date),
    COUNT(*) FILTER (WHERE event_type = 'session_started'),
    COUNT(*) FILTER (WHERE event_type = 'goal_created'),
    COUNT(*) FILTER (WHERE event_type = 'goal_completed'),
    COUNT(*) FILTER (WHERE event_type = 'task_created'),
    COUNT(*) FILTER (WHERE event_type = 'task_completed'),
    COUNT(*) FILTER (WHERE event_type = 'focus_session_completed'),
    COUNT(*) FILTER (WHERE event_type = 'weekly_plan_completed')
  INTO
    v_last_access,
    v_active_days,
    v_sessions,
    v_goals_created,
    v_goals_completed,
    v_tasks_created,
    v_tasks_completed,
    v_pomodoros,
    v_weekly_plans
  FROM public.events
  WHERE user_id = p_user_id;
  
  -- Task completion rate
  IF v_tasks_created > 0 THEN
    v_completion_rate := ROUND((v_tasks_completed::numeric / v_tasks_created::numeric) * 100, 1);
  ELSE
    v_completion_rate := 0.0;
  END IF;

  v_result := json_build_object(
    'email', COALESCE(v_email, 'Sem e-mail'),
    'created_at', v_created_at,
    'last_access', v_last_access,
    'active_days', COALESCE(v_active_days, 0),
    'sessions', COALESCE(v_sessions, 0),
    'goals_created', COALESCE(v_goals_created, 0),
    'goals_completed', COALESCE(v_goals_completed, 0),
    'tasks_created', COALESCE(v_tasks_created, 0),
    'tasks_completed', COALESCE(v_tasks_completed, 0),
    'pomodoros', COALESCE(v_pomodoros, 0),
    'weekly_plans', COALESCE(v_weekly_plans, 0),
    'completion_rate', COALESCE(v_completion_rate, 0.0)
  );
  
  RETURN v_result;
END;
$$;

-- Revoke public execution rights to prevent common users from querying
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() FROM public;
REVOKE EXECUTE ON FUNCTION public.get_user_detail_metrics(uuid) FROM public;

-- Grant execute rights explicitly to authenticated role
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_detail_metrics(uuid) TO authenticated;

-- 5. Create Materialized Views for Scale Optimization
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_active_users_daily AS
SELECT created_at::date AS date, COUNT(DISTINCT user_id) AS active_users
FROM public.events
GROUP BY created_at::date;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_active_users_weekly AS
SELECT date_trunc('week', created_at)::date AS week, COUNT(DISTINCT user_id) AS active_users
FROM public.events
GROUP BY date_trunc('week', created_at)::date;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_active_users_monthly AS
SELECT date_trunc('month', created_at)::date AS month, COUNT(DISTINCT user_id) AS active_users
FROM public.events
GROUP BY date_trunc('month', created_at)::date;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_retention_metrics AS
SELECT 
  p.id AS user_id,
  p.created_at::date AS signup_date,
  EXISTS (
    SELECT 1 FROM public.events r 
    WHERE r.user_id = p.id 
      AND r.created_at >= p.created_at + INTERVAL '1 day' 
      AND r.created_at < p.created_at + INTERVAL '2 days'
  ) AS retained_d1,
  EXISTS (
    SELECT 1 FROM public.events r 
    WHERE r.user_id = p.id 
      AND r.created_at >= p.created_at + INTERVAL '7 days' 
      AND r.created_at < p.created_at + INTERVAL '8 days'
  ) AS retained_d7,
  EXISTS (
    SELECT 1 FROM public.events r 
    WHERE r.user_id = p.id 
      AND r.created_at >= p.created_at + INTERVAL '30 days' 
      AND r.created_at < p.created_at + INTERVAL '31 days'
  ) AS retained_d30
FROM public.profiles p;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monetization_metrics AS
SELECT
  COUNT(*) FILTER (WHERE event_type = 'paywall_viewed') AS total_paywall_views,
  COUNT(*) FILTER (WHERE event_type = 'upgrade_clicked') AS total_upgrade_clicks,
  (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active') AS active_subscribers,
  (SELECT COALESCE(SUM(price), 0.0) FROM public.subscriptions WHERE status = 'active') AS current_mrr
FROM public.events;

-- Unique indexes for concurrent refreshes
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_active_users_daily ON mv_active_users_daily (date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_active_users_weekly ON mv_active_users_weekly (week);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_active_users_monthly ON mv_active_users_monthly (month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_retention_metrics ON mv_retention_metrics (user_id);

-- Refresh function
CREATE OR REPLACE FUNCTION public.refresh_analytics_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_active_users_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_active_users_weekly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_active_users_monthly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_retention_metrics;
  REFRESH MATERIALIZED VIEW mv_monetization_metrics; -- Refresh normal as it is only 1 row
END;
$$;

-- 6. Future Range Partitioning Strategy Documentation (Architecture Preparation)
--
-- Para particionar a tabela public.events por data de criação (created_at):
-- 
-- 1. Criar a tabela base particionada (não é possível converter uma tabela existente diretamente):
--    CREATE TABLE public.events_partitioned (
--      id UUID NOT NULL,
--      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
--      event_type TEXT NOT NULL,
--      metadata JSONB DEFAULT '{}'::jsonb,
--      created_at TIMESTAMPTZ DEFAULT now(),
--      PRIMARY KEY (id, created_at) -- A chave de particionamento deve fazer parte da chave primária
--    ) PARTITION BY RANGE (created_at);
--
-- 2. Criar as partições para intervalos específicos (ex: mensal):
--    CREATE TABLE public.events_y2026m06 PARTITION OF public.events_partitioned
--      FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');
--    CREATE TABLE public.events_y2026m07 PARTITION OF public.events_partitioned
--      FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');
--
-- 3. Migrar os dados existentes:
--    INSERT INTO public.events_partitioned (id, user_id, event_type, metadata, created_at)
--    SELECT id, user_id, event_type, metadata, created_at FROM public.events;
--
-- 4. Renomear as tabelas:
--    ALTER TABLE public.events RENAME TO events_old;
--    ALTER TABLE public.events_partitioned RENAME TO events;
--
-- 5. Recriar índices, RLS, triggers e políticas na nova tabela.
-- 6. Executar validação de integridade e remover a tabela events_old.
