-- supabase_migrations_v2.sql
-- Migration file for Flowday V2: Scalability Indexes, Views, and RPC Functions

-- 1. Create Performance Indexes for events table
CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id_created_at ON public.events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_event_type_created_at ON public.events(event_type, created_at);

-- 2. Grant permissions on indexes / schema migrations if needed
-- (Indexes are managed by PG under the hood)

-- 3. Create RPC Function to calculate Admin Dashboard Metrics (SaaS Analytics V2)
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
  
  v_result json;
BEGIN
  -- Count total users from profiles
  SELECT COUNT(*) INTO v_total_users FROM public.profiles;
  
  -- Active users count from events
  SELECT COUNT(DISTINCT user_id) INTO v_active_today FROM public.events WHERE created_at >= NOW() - INTERVAL '1 day';
  SELECT COUNT(DISTINCT user_id) INTO v_active_7d FROM public.events WHERE created_at >= NOW() - INTERVAL '7 days';
  SELECT COUNT(DISTINCT user_id) INTO v_active_30d FROM public.events WHERE created_at >= NOW() - INTERVAL '30 days';
  
  -- Engagement actions
  SELECT COUNT(*) INTO v_goal_created FROM public.events WHERE event_type = 'goal_created';
  SELECT COUNT(*) INTO v_goal_completed FROM public.events WHERE event_type = 'goal_completed';
  SELECT COUNT(*) INTO v_task_created FROM public.events WHERE event_type = 'task_created';
  SELECT COUNT(*) INTO v_task_completed FROM public.events WHERE event_type = 'task_completed';
  
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

  -- Feature usage
  SELECT COUNT(*) INTO v_focus_completed FROM public.events WHERE event_type = 'focus_session_completed';
  SELECT COUNT(*) INTO v_weekly_plans FROM public.events WHERE event_type = 'weekly_plan_completed';
  SELECT COUNT(*) INTO v_calendar_tasks FROM public.events WHERE event_type = 'calendar_task_completed';
  SELECT COUNT(*) INTO v_habits_completed FROM public.events WHERE event_type = 'habit_completed';

  -- Monetization metrics
  SELECT COUNT(*) INTO v_paywall_views FROM public.events WHERE event_type = 'paywall_viewed';
  SELECT COUNT(*) INTO v_upgrade_clicks FROM public.events WHERE event_type = 'upgrade_clicked';
  
  -- Pro users count (from auth.users metadata)
  SELECT COUNT(*) INTO v_pro_count FROM auth.users WHERE raw_user_meta_data->>'is_pro' = 'true';
  
  IF v_paywall_views > 0 THEN
    v_monetization_conversion := ROUND((v_pro_count::numeric / v_paywall_views::numeric) * 100, 1);
  ELSE
    v_monetization_conversion := 0;
  END IF;
  
  v_mrr := v_pro_count * 29.90;
  v_arr := v_mrr * 12;
  v_churn := 5.0; -- default churn estimation

  -- Cohort retention D1, D7, D30 calculations
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
    'mrr', COALESCE(v_mrr, 0.0),
    'arr', COALESCE(v_arr, 0.0),
    'churn', COALESCE(v_churn, 0.0)
  );

  RETURN v_result;
END;
$$;

-- 4. Create RPC Function to calculate Individual User Metrics (SaaS Analytics V2)
CREATE OR REPLACE FUNCTION public.get_user_detail_metrics(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
  -- Get user email and creation date from auth.users
  SELECT email, created_at INTO v_email, v_created_at FROM auth.users WHERE id = p_user_id;
  
  -- Last access
  SELECT MAX(created_at) INTO v_last_access FROM public.events WHERE user_id = p_user_id;
  
  -- Distinct active days
  SELECT COUNT(DISTINCT created_at::date) INTO v_active_days FROM public.events WHERE user_id = p_user_id;
  
  -- Sessions
  SELECT COUNT(*) INTO v_sessions FROM public.events WHERE user_id = p_user_id AND event_type = 'session_started';
  
  -- Metrics counts
  SELECT COUNT(*) INTO v_goals_created FROM public.events WHERE user_id = p_user_id AND event_type = 'goal_created';
  SELECT COUNT(*) INTO v_goals_completed FROM public.events WHERE user_id = p_user_id AND event_type = 'goal_completed';
  SELECT COUNT(*) INTO v_tasks_created FROM public.events WHERE user_id = p_user_id AND event_type = 'task_created';
  SELECT COUNT(*) INTO v_tasks_completed FROM public.events WHERE user_id = p_user_id AND event_type = 'task_completed';
  SELECT COUNT(*) INTO v_pomodoros FROM public.events WHERE user_id = p_user_id AND event_type = 'focus_session_completed';
  SELECT COUNT(*) INTO v_weekly_plans FROM public.events WHERE user_id = p_user_id AND event_type = 'weekly_plan_completed';
  
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
