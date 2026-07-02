-- =======================================================
-- MIGRATION V43: PUSH DELIVERY EVIDENCE & NOTIFICATION_LOGS SCHEMA FIX
-- Adiciona colunas para armazenar a resposta real do FCM/WebPush
-- e corrige o schema mismatch em notification_logs.
-- =======================================================

-- 1. notification_queue: adicionar colunas de evidência do provider
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS provider_status INTEGER;
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS provider_response TEXT;

-- 2. notification_logs: adicionar colunas que o worker já tenta escrever (corrigir schema mismatch)
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS notification_queue_id UUID;
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 3. notification_logs: adicionar colunas de evidência do provider
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS provider_status INTEGER;
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
ALTER TABLE public.notification_logs ADD COLUMN IF NOT EXISTS provider_response TEXT;
