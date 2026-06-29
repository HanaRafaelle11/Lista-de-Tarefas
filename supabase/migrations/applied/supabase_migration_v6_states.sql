-- =======================================================
-- MIGRATION: MYFLOWDAY BILLING ENGINE - STATE MACHINE UPDATE (V6)
-- =======================================================

-- 1. Drop existing check constraint if it exists to allow uppercase statuses
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_assinatura_status_check;

-- 2. Add the updated check constraint with uppercase unified statuses
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_assinatura_status_check 
  CHECK (assinatura_status IN ('ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'REACTIVATION_PENDING', 'TRIALING', 'FREE', 'free'));

-- 3. Update comments to document the new unified state machine
COMMENT ON COLUMN public.profiles.assinatura_status IS 'Unified subscription status: ACTIVE, PAST_DUE, CANCELED, EXPIRED, REACTIVATION_PENDING, TRIALING, or FREE';
