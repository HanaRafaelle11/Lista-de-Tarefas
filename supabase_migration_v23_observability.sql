-- ============================================================
-- MIGRATION: PAYMENT OBSERVABILITY & INTEGRITY SCHEMA (V23)
-- Execute this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mftsklhrzhhvtsuamqaw/sql/new
-- ============================================================

-- Create the payment_events table if not exists
CREATE TABLE IF NOT EXISTS public.payment_events (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp         timestamptz DEFAULT now(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id   text,
  payment_id        text,
  customer_id       text,
  gateway           text DEFAULT 'asaas',
  status            text NOT NULL DEFAULT 'pending',
  event             text NOT NULL,
  request           jsonb,
  response          jsonb,
  payload           jsonb,
  error             text,
  processing_time   integer,
  processed         boolean DEFAULT false,
  source            text
);

-- Indexing for optimized queries
CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON public.payment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON public.payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_subscription_id ON public.payment_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_timestamp ON public.payment_events(timestamp DESC);

-- Enable RLS
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Create Policies
DROP POLICY IF EXISTS service_role_all ON public.payment_events;
CREATE POLICY service_role_all ON public.payment_events FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS user_read_own ON public.payment_events;
CREATE POLICY user_read_own ON public.payment_events FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS admin_read_all ON public.payment_events;
CREATE POLICY admin_read_all ON public.payment_events FOR SELECT TO authenticated USING (
  auth.jwt() ->> 'email' = 'hanarafaelle11@gmail.com'
);

-- Grant select permission
GRANT SELECT ON public.payment_events TO authenticated;

-- Fix the get_admin_users_list() function caller email validation to include hanarafaelle11@gmail.com
CREATE OR REPLACE FUNCTION public.get_admin_users_list()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_email text;
  v_users_json json;
BEGIN
  -- Strict Admin check
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

-- Fix the get_admin_dashboard_metrics() function caller email validation to include hanarafaelle11@gmail.com
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_email text;
  v_metrics json;
BEGIN
  v_caller_email := auth.jwt()->>'email';
  IF v_caller_email NOT IN ('hanarafaelle11@gmail.com', 'admin@flowday.app', 'rafaelle@flowday.app', 'rafox@flowday.app') OR v_caller_email IS NULL THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem executar esta função.' USING ERRCODE = '42501';
  END IF;

  -- Return compiled KPIs
  SELECT json_build_object(
    'mrr', COALESCE((SELECT mrr FROM public.vw_mrr_metrics ORDER BY date DESC LIMIT 1), 0.0),
    'arr', COALESCE((SELECT arr FROM public.vw_mrr_metrics ORDER BY date DESC LIMIT 1), 0.0),
    'churn_rate', COALESCE((SELECT churn_rate FROM public.vw_churn_metrics ORDER BY month DESC LIMIT 1), 0.0),
    'active_subscribers', COALESCE((SELECT count(*) FROM public.subscriptions WHERE status = 'active'), 0),
    'paywall_views', COALESCE((SELECT count(*) FROM public.events WHERE event_type = 'paywall_view'), 0),
    'upgrade_clicks', COALESCE((SELECT count(*) FROM public.events WHERE event_type = 'upgrade_click'), 0),
    'onboarding_started', COALESCE((SELECT count(*) FROM public.events WHERE event_type = 'onboarding_started'), 0),
    'onboarding_step1', COALESCE((SELECT count(*) FROM public.events WHERE event_type = 'onboarding_step1'), 0),
    'onboarding_step2', COALESCE((SELECT count(*) FROM public.events WHERE event_type = 'onboarding_step2'), 0),
    'onboarding_step3', COALESCE((SELECT count(*) FROM public.events WHERE event_type = 'onboarding_step3'), 0),
    'onboarding_step4', COALESCE((SELECT count(*) FROM public.events WHERE event_type = 'onboarding_step4'), 0),
    'onboarding_completed', COALESCE((SELECT count(*) FROM public.events WHERE event_type = 'onboarding_completed'), 0),
    'monetization_conversion', COALESCE(
      ROUND(
        (SELECT count(*)::numeric FROM public.subscriptions WHERE status = 'active') / 
        NULLIF((SELECT count(*)::numeric FROM public.events WHERE event_type = 'paywall_view'), 0) * 100, 
        2
      ), 
      0.0
    )
  ) INTO v_metrics;

  RETURN v_metrics;
END;
$$;

-- Alter subscriptions table default price to 14.90 instead of 29.90
ALTER TABLE public.subscriptions ALTER COLUMN price SET DEFAULT 14.90;

-- Update existing subscriptions with price = 29.90 to be 14.90
UPDATE public.subscriptions SET price = 14.90 WHERE price = 29.90;
