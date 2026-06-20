-- ==========================================
-- FLOWDAY V4 - SOFT DELETE (TRASH) SUPPORT
-- ==========================================

-- 1. Add deleted_at columns to tasks and goals
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON public.tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_goals_deleted_at ON public.goals(deleted_at);
