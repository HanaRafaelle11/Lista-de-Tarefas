-- =======================================================
-- MIGRATION: MYFLOWDAY STRIPE-STYLE FINANCIAL ANALYTICS (V9)
-- =======================================================

-- 1. vw_mrr_metrics (Daily active MRR, ARR, and Churn-adjusted MRR)
CREATE OR REPLACE VIEW public.vw_mrr_metrics AS
WITH daily_calendar AS (
  SELECT (d.day::date)::timestamp as day_date
  FROM generate_series(
    now() - interval '29 days',
    now(),
    '1 day'::interval
  ) d(day)
)
SELECT
  to_char(dc.day_date, 'YYYY-MM-DD') as date,
  coalesce(sum(s.price) filter (where s.created_at <= dc.day_date and (s.status <> 'canceled' or s.updated_at > dc.day_date)), 0.0) as mrr,
  coalesce(sum(s.price) filter (where s.created_at <= dc.day_date and (s.status <> 'canceled' or s.updated_at > dc.day_date)), 0.0) * 12 as arr,
  coalesce(sum(s.price) filter (where s.created_at <= dc.day_date and (s.status <> 'canceled' or s.updated_at > dc.day_date)), 0.0) -
    coalesce(sum(s.price) filter (where s.status = 'canceled' and date_trunc('day', s.updated_at) = date_trunc('day', dc.day_date)), 0.0) as churn_adjusted_mrr
FROM daily_calendar dc
LEFT JOIN public.subscriptions s ON s.created_at <= dc.day_date
GROUP BY dc.day_date
ORDER BY dc.day_date ASC;

-- 2. vw_churn_metrics (Monthly users canceled, monthly churn rate %, monthly churned MRR)
CREATE OR REPLACE VIEW public.vw_churn_metrics AS
WITH months AS (
  SELECT generate_series(
    date_trunc('month', coalesce(min(created_at), now())),
    date_trunc('month', now()),
    '1 month'::interval
  ) as month
  FROM public.subscriptions
)
SELECT
  to_char(m.month, 'YYYY-MM') as month,
  coalesce(count(distinct s.user_id) filter (where s.status = 'canceled' and date_trunc('month', s.updated_at) = m.month), 0) as churned_users,
  coalesce(
    (count(distinct s.user_id) filter (where s.status = 'canceled' and date_trunc('month', s.updated_at) = m.month))::numeric / 
    nullif(count(distinct s.user_id) filter (where s.created_at < m.month + interval '1 month'), 0),
    0.0
  ) * 100 as churn_rate,
  coalesce(sum(s.price) filter (where s.status = 'canceled' and date_trunc('month', s.updated_at) = m.month), 0.0) as revenue_churn
FROM months m
LEFT JOIN public.subscriptions s ON s.created_at < m.month + interval '1 month'
GROUP BY m.month
ORDER BY m.month ASC;

-- 3. vw_arpu_metrics (Daily Total Revenue, Active Users, and ARPU)
CREATE OR REPLACE VIEW public.vw_arpu_metrics AS
WITH daily_calendar AS (
  SELECT (d.day::date)::timestamp as day_date
  FROM generate_series(
    now() - interval '29 days',
    now(),
    '1 day'::interval
  ) d(day)
)
SELECT
  to_char(dc.day_date, 'YYYY-MM-DD') as date,
  coalesce(sum(s.price) filter (where s.created_at <= dc.day_date and (s.status <> 'canceled' or s.updated_at > dc.day_date)), 0.0) as total_revenue,
  coalesce(count(distinct s.user_id) filter (where s.created_at <= dc.day_date and (s.status <> 'canceled' or s.updated_at > dc.day_date)), 0) as active_users,
  coalesce(
    sum(s.price) filter (where s.created_at <= dc.day_date and (s.status <> 'canceled' or s.updated_at > dc.day_date)) / 
    nullif(count(distinct s.user_id) filter (where s.created_at <= dc.day_date and (s.status <> 'canceled' or s.updated_at > dc.day_date)), 0),
    0.0
  ) as arpu
FROM daily_calendar dc
LEFT JOIN public.subscriptions s ON s.created_at <= dc.day_date
GROUP BY dc.day_date
ORDER BY dc.day_date ASC;

-- 4. vw_cohort_retention (Stripe-style 12-month cohort retention matrix)
CREATE OR REPLACE VIEW public.vw_cohort_retention AS
WITH cohorts AS (
  SELECT DISTINCT date_trunc('month', created_at) as cohort_month
  FROM public.subscriptions
),
cohort_periods AS (
  SELECT
    c.cohort_month,
    p.period,
    c.cohort_month + (p.period * interval '1 month') as period_month
  FROM cohorts c
  CROSS JOIN generate_series(0, 12) p(period)
  WHERE c.cohort_month + (p.period * interval '1 month') <= date_trunc('month', now())
),
cohort_sizes AS (
  SELECT
    date_trunc('month', created_at) as cohort_month,
    count(distinct user_id) as total_users
  FROM public.subscriptions
  GROUP BY 1
),
active_users_per_period AS (
  SELECT
    cp.cohort_month,
    cp.period,
    count(distinct s.user_id) as active_users
  FROM cohort_periods cp
  JOIN public.subscriptions s ON date_trunc('month', s.created_at) = cp.cohort_month
  WHERE 
    s.status <> 'canceled'
    OR date_trunc('month', s.updated_at) >= cp.period_month
  GROUP BY cp.cohort_month, cp.period
)
SELECT
  to_char(cp.cohort_month, 'YYYY-MM-DD') as cohort_month,
  cp.period,
  coalesce(a.active_users, 0) as active_users,
  coalesce(cs.total_users, 0) as total_users,
  coalesce(
    (coalesce(a.active_users, 0)::numeric / nullif(cs.total_users, 0)) * 100,
    0.0
  ) as retention_rate
FROM cohort_periods cp
LEFT JOIN cohort_sizes cs ON cp.cohort_month = cs.cohort_month
LEFT JOIN active_users_per_period a ON cp.cohort_month = a.cohort_month AND cp.period = a.period
ORDER BY cp.cohort_month DESC, cp.period ASC;

-- 5. vw_growth_metrics (Monthly new subscriptions and reactivations)
CREATE OR REPLACE VIEW public.vw_growth_metrics AS
WITH calendar AS (
  SELECT generate_series(
    date_trunc('month', coalesce(min(created_at), now())),
    date_trunc('month', now()),
    '1 month'::interval
  ) as month
  FROM public.subscriptions
),
new_subs AS (
  SELECT
    date_trunc('month', created_at) as month,
    count(distinct id) as new_subscriptions
  FROM public.subscriptions
  GROUP BY 1
),
reactivated_subs AS (
  SELECT
    date_trunc('month', created_at) as month,
    count(distinct user_id) as reactivations
  FROM public.events
  WHERE event_type = 'user_reactivated'
  GROUP BY 1
)
SELECT
  to_char(c.month, 'YYYY-MM') as month,
  coalesce(n.new_subscriptions, 0) as new_subscriptions,
  coalesce(r.reactivations, 0) as reactivations
FROM calendar c
LEFT JOIN new_subs n ON c.month = n.month
LEFT JOIN reactivated_subs r ON c.month = r.month
ORDER BY c.month ASC;
