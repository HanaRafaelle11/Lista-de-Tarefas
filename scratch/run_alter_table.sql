-- Run this in the Supabase SQL Editor to add the dismissed_at column
ALTER TABLE public.user_achievements ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ DEFAULT NULL;
