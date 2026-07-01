-- =======================================================
-- MIGRATION: LINTER SECURITY HARDENING & RLS REFINEMENTS (V37)
-- =======================================================

-- ── 1. CORREÇÃO DE POLÍTICAS DA TABELA push_subscriptions ──

-- Garantir RLS ativo
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Remover políticas legadas ou permissivas
DROP POLICY IF EXISTS "Allow service and authenticated inserts" ON public.push_subscriptions;
DROP POLICY IF EXISTS "allow_manage_own_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_read_only_select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow service_role full access on push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow authenticated select on push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow authenticated insert on push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow authenticated update on push_subscriptions" ON public.push_subscriptions;

-- A) Política para service_role (acesso irrestrito para Edge Functions e pg_cron)
CREATE POLICY "Allow service_role full access on push_subscriptions"
  ON public.push_subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- B) Políticas granulares para usuários autenticados (apenas seu próprio user_id)
CREATE POLICY "Allow authenticated select on push_subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated insert on push_subscriptions"
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated update on push_subscriptions"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 2. CORREÇÃO DE POLÍTICAS DA TABELA push_telemetry ──

-- Garantir RLS ativo
ALTER TABLE public.push_telemetry ENABLE ROW LEVEL SECURITY;

-- Remover e recriar política de INSERT para garantir que o usuário só envie telemetria para si mesmo
DROP POLICY IF EXISTS "Allow authenticated users to insert telemetry" ON public.push_telemetry;
CREATE POLICY "Allow authenticated users to insert telemetry"
  ON public.push_telemetry FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ── 3. REDEFINIÇÃO DE FUNÇÕES COM SEARCH_PATH RÍGIDO (SET search_path = public) ──

-- A) public.handle_task_events
CREATE OR REPLACE FUNCTION public.handle_task_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.handle_task_notifications();
END;
$$;

-- B) public.parse_metadata
CREATE OR REPLACE FUNCTION public.parse_metadata(p_description text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_parts text[];
  v_meta jsonb;
BEGIN
  IF p_description IS NULL OR p_description = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  
  IF position('--flowday-meta--' in p_description) = 0 THEN
    RETURN '{}'::jsonb;
  END IF;
  
  v_parts := string_to_array(p_description, '--flowday-meta--');
  IF array_length(v_parts, 1) < 2 THEN
    RETURN '{}'::jsonb;
  END IF;
  
  BEGIN
    v_meta := trim(v_parts[2])::jsonb;
    RETURN v_meta;
  EXCEPTION WHEN OTHERS THEN
    RETURN '{}'::jsonb;
  END;
END;
$$;

-- C) public.combine_date_time_tz
CREATE OR REPLACE FUNCTION public.combine_date_time_tz(p_date text, p_time text)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_date IS NULL OR p_date = '' THEN
    RETURN NULL;
  END IF;
  
  IF p_time IS NULL OR p_time = '' THEN
    p_time := '09:00';
  END IF;
  
  IF p_time ~ '^[0-9]{2}:[0-9]{2}$' THEN
    RETURN (p_date || 'T' || p_time || ':00-03:00')::TIMESTAMPTZ;
  ELSE
    RETURN (p_date || 'T09:00:00-03:00')::TIMESTAMPTZ;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- D) public.trg_tasks_unified_eda_func
CREATE OR REPLACE FUNCTION public.trg_tasks_unified_eda_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta jsonb;
  v_due_time text;
  v_sched_time TIMESTAMPTZ;
  v_key text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notification_queue 
    WHERE entity_type = 'task' AND entity_id = OLD.id::text AND status = 'pending';
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF (NEW.completed = true OR NEW.due_date IS NULL OR NEW.due_date = '') THEN
      DELETE FROM public.notification_queue 
      WHERE entity_type = 'task' AND entity_id = NEW.id::text AND status = 'pending';
    END IF;
  END IF;

  IF (NEW.due_date IS NOT NULL AND NEW.due_date <> '' AND (NEW.completed IS NOT TRUE)) THEN
    v_meta := public.parse_metadata(NEW.description);
    v_due_time := v_meta->>'due_time';
    
    v_sched_time := public.combine_date_time_tz(NEW.due_date::text, v_due_time);
    
    IF v_sched_time IS NOT NULL THEN
      DELETE FROM public.notification_queue 
      WHERE entity_type = 'task' AND entity_id = NEW.id::text AND status = 'pending';

      v_key := 'task_due_' || NEW.id::text || '_' || NEW.due_date::text || '_' || COALESCE(v_due_time, '0900') || '_ontime';
      INSERT INTO public.notification_queue (
        event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
      ) VALUES (
        'TASK_DUE', 'task', NEW.id::text, NEW.user_id, 'Tarefa Vencendo Agora ⏰',
        '"' || NEW.title || '" vence agora no MyFlowDay.',
        to_jsonb(NEW), v_sched_time, 'high', v_key
      ) ON CONFLICT (idempotency_key) DO UPDATE
      SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = now();

      IF (v_sched_time - INTERVAL '15 minutes' > now()) THEN
        v_key := 'task_due_' || NEW.id::text || '_' || NEW.due_date::text || '_' || COALESCE(v_due_time, '0900') || '_15min';
        INSERT INTO public.notification_queue (
          event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
        ) VALUES (
          'TASK_DUE', 'task', NEW.id::text, NEW.user_id, '⏰ Tarefa em 15 minutos',
          '"' || NEW.title || '" vence em breve no MyFlowDay.',
          to_jsonb(NEW), v_sched_time - INTERVAL '15 minutes', 'normal', v_key
        ) ON CONFLICT (idempotency_key) DO UPDATE
        SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = now();
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- E) public.trg_goals_unified_eda_func
CREATE OR REPLACE FUNCTION public.trg_goals_unified_eda_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta jsonb;
  v_start_time text;
  v_sched_time TIMESTAMPTZ;
  v_key text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notification_queue 
    WHERE entity_type = 'goal' AND entity_id = OLD.id::text AND status = 'pending';
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF (NEW.status = 'completed' OR NEW.status = 'canceled' OR NEW.target_date IS NULL OR NEW.target_date = '') THEN
      DELETE FROM public.notification_queue 
      WHERE entity_type = 'goal' AND entity_id = NEW.id::text AND status = 'pending';
    END IF;
  END IF;

  IF (NEW.target_date IS NOT NULL AND NEW.target_date <> '' AND (NEW.status = 'active')) THEN
    v_meta := public.parse_metadata(NEW.description);
    v_start_time := COALESCE(NEW.start_time, v_meta->>'start_time');

    v_sched_time := public.combine_date_time_tz(NEW.target_date::text, v_start_time);

    IF v_sched_time IS NOT NULL THEN
      DELETE FROM public.notification_queue 
      WHERE entity_type = 'goal' AND entity_id = NEW.id::text AND status = 'pending';

      v_key := 'goal_due_' || NEW.id::text || '_' || NEW.target_date::text || '_' || COALESCE(v_start_time, '0900') || '_ontime';
      INSERT INTO public.notification_queue (
        event_type, entity_type, entity_id, user_id, title, body, payload, scheduled_for, priority, idempotency_key
      ) VALUES (
        'GOAL_DUE', 'goal', NEW.id::text, NEW.user_id, 'Objetivo Vencendo Hoje 🎯',
        'Seu objetivo "' || NEW.title || '" vence hoje no MyFlowDay.',
        to_jsonb(NEW), v_sched_time, 'high', v_key
      ) ON CONFLICT (idempotency_key) DO UPDATE
      SET scheduled_for = EXCLUDED.scheduled_for, status = 'pending', updated_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- F) public.get_admin_dashboard_metrics
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email text;
  v_metrics json;
  v_health_score json;
BEGIN
  v_caller_email := auth.jwt()->>'email';
  IF v_caller_email NOT IN ('hanarafaelle11@gmail.com', 'admin@flowday.app', 'rafaelle@flowday.app', 'rafox@flowday.app') OR v_caller_email IS NULL THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem executar esta função.' USING ERRCODE = '42501';
  END IF;

  v_health_score := public.calculate_business_health_score();

  SELECT json_build_object(
    'mrr', COALESCE((SELECT mrr FROM public.vw_mrr_metrics ORDER BY date DESC LIMIT 1), 0.0),
    'arr', COALESCE((SELECT arr FROM public.vw_mrr_metrics ORDER BY date DESC LIMIT 1), 0.0),
    'churn_rate', COALESCE((SELECT churn_rate FROM public.vw_churn_metrics ORDER BY month DESC LIMIT 1), 0.0),
    'active_subscribers', COALESCE((SELECT count(*) FROM public.subscriptions WHERE status = 'active'), 0),
    'health_score', v_health_score
  ) INTO v_metrics;

  RETURN v_metrics;
END;
$$;

-- G) public.get_admin_users_list
CREATE OR REPLACE FUNCTION public.get_admin_users_list()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email text;
  v_users_json json;
BEGIN
  v_caller_email := auth.jwt()->>'email';
  IF v_caller_email NOT IN ('hanarafaelle11@gmail.com', 'admin@flowday.app', 'rafaelle@flowday.app', 'rafox@flowday.app') OR v_caller_email IS NULL THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem executar esta função.' USING ERRCODE = '42501';
  END IF;

  SELECT json_agg(u) INTO v_users_json
  FROM (
    SELECT 
      p.id,
      p.name AS nickname,
      au.email,
      au.created_at,
      COALESCE((
        SELECT MAX(e.created_at) 
        FROM public.events e 
        WHERE e.user_id = p.id
      ), au.created_at) AS last_login,
      COALESCE(sub.plan, 'free') AS plan,
      COALESCE(sub.status, 'inactive') AS status,
      COALESCE((
        SELECT COUNT(*) 
        FROM public.events e 
        WHERE e.user_id = p.id
      ), 0) AS total_events
    FROM public.profiles p
    JOIN auth.users au ON p.id = au.id
    LEFT JOIN public.subscriptions sub ON p.id = sub.user_id
    ORDER BY au.created_at DESC
  ) u;

  RETURN COALESCE(v_users_json, '[]'::json);
END;
$$;

-- H) public.get_user_detail_metrics
CREATE OR REPLACE FUNCTION public.get_user_detail_metrics(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_caller_email := auth.jwt()->>'email';
  IF (v_caller_email NOT IN ('hanarafaelle11@gmail.com', 'admin@flowday.app', 'rafaelle@flowday.app', 'rafox@flowday.app') OR v_caller_email IS NULL)
     AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Acesso negado. Não autorizado.' USING ERRCODE = '42501';
  END IF;

  SELECT email, created_at INTO v_email, v_created_at FROM auth.users WHERE id = p_user_id;
  
  SELECT
    MAX(created_at),
    COUNT(DISTINCT created_at::date),
    COUNT(*) FILTER (WHERE event_type = 'focus_session_completed'),
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

-- I) public.handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, nickname)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$;

-- J) public.refresh_analytics_materialized_views
CREATE OR REPLACE FUNCTION public.refresh_analytics_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_active_users_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_active_users_weekly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_active_users_monthly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_retention_metrics;
  REFRESH MATERIALIZED VIEW mv_monetization_metrics;
END;
$$;
