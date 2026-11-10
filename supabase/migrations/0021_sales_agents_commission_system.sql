-- =====================================================================
-- Migration 0021: Sales Agents, Variable Commissions, Joining Fee (50%),
-- Recurring Monthly Commissions, Payout Ledger & Dedicated Agent Portal
-- EduTechLab SaaS Platform
-- =====================================================================

-- 1. Sales Agents Table
CREATE TABLE IF NOT EXISTS public.sales_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  agent_code text NOT NULL UNIQUE,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  joining_commission_percent numeric(5,2) NOT NULL DEFAULT 50.00
    CHECK (joining_commission_percent >= 0 AND joining_commission_percent <= 100),
  recurring_commission_percent numeric(5,2) NOT NULL DEFAULT 20.00
    CHECK (recurring_commission_percent >= 0 AND recurring_commission_percent <= 100),
  upi_id text,
  bank_details text,
  city text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_agents_code ON public.sales_agents (upper(agent_code));
CREATE INDEX IF NOT EXISTS idx_sales_agents_email ON public.sales_agents (lower(email));

-- 2. Sales Agent Sessions Table (for Dedicated Agent Login Portal)
CREATE TABLE IF NOT EXISTS public.sales_agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.sales_agents(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_agent_sessions_token ON public.sales_agent_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_sales_agent_sessions_agent ON public.sales_agent_sessions (agent_id);

-- 3. Add Referral Attribution Columns to Organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS referred_by_agent_id uuid REFERENCES public.sales_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at timestamptz,
  ADD COLUMN IF NOT EXISTS referral_code_used text;

CREATE INDEX IF NOT EXISTS idx_organizations_referred_agent ON public.organizations (referred_by_agent_id);

-- 4. Add Payment Category & Joining Fee Breakdown Columns to Subscription Payments
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS payment_category text NOT NULL DEFAULT 'recurring',
  ADD COLUMN IF NOT EXISTS joining_fee_portion numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_subscription_payments_category'
  ) THEN
    ALTER TABLE public.subscription_payments
      ADD CONSTRAINT chk_subscription_payments_category
      CHECK (payment_category IN ('joining_fee', 'recurring', 'combined'));
  END IF;
END $$;

-- 5. Agent Commissions Ledger Table
-- Preserves permanent accounting history even if 7-day payment screenshots are cleaned up
CREATE TABLE IF NOT EXISTS public.agent_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.sales_agents(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  organization_name text NOT NULL,
  source_payment_id uuid REFERENCES public.subscription_payments(id) ON DELETE SET NULL,
  commission_type text NOT NULL CHECK (commission_type IN ('joining_fee', 'recurring', 'bonus_adjustment')),
  gross_payment_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_percent numeric(5,2) NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL,
  reference_utr text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_commissions_payment_type
  ON public.agent_commissions (source_payment_id, commission_type)
  WHERE source_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent ON public.agent_commissions (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_org ON public.agent_commissions (organization_id);

-- 6. Agent Payouts Table (Records payments settled by Super Admin to Agents)
CREATE TABLE IF NOT EXISTS public.agent_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.sales_agents(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'upi',
  reference_no text,
  paid_for_month text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_payouts_agent ON public.agent_payouts (agent_id, paid_at DESC);

-- 7. Row Level Security (Strict Lockout - All Reads/Writes via Verified SECURITY DEFINER RPCs)
ALTER TABLE public.sales_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_payouts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admins_manage_sales_agents' AND tablename = 'sales_agents') THEN
    CREATE POLICY "super_admins_manage_sales_agents" ON public.sales_agents
      FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admins_manage_agent_sessions' AND tablename = 'sales_agent_sessions') THEN
    CREATE POLICY "super_admins_manage_agent_sessions" ON public.sales_agent_sessions
      FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admins_manage_agent_commissions' AND tablename = 'agent_commissions') THEN
    CREATE POLICY "super_admins_manage_agent_commissions" ON public.agent_commissions
      FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admins_manage_agent_payouts' AND tablename = 'agent_payouts') THEN
    CREATE POLICY "super_admins_manage_agent_payouts" ON public.agent_payouts
      FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
  END IF;
END $$;

-- 8. Password Hash & Super Admin Auth Helpers
CREATE OR REPLACE FUNCTION public._hash_agent_password(p_salt text, p_password text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(sha256((coalesce(p_salt, '') || ':' || coalesce(p_password, ''))::bytea), 'hex');
$$;

CREATE OR REPLACE FUNCTION public._verify_super_admin(p_master_code text DEFAULT null)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.is_platform_admin() OR coalesce(trim(p_master_code), '') = 'Edutechlab@#78692';
END;
$$;

-- 9. Public Referral Code Verification (Safe Read-Only Preview for /register)
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
  v_agent record;
BEGIN
  v_clean := upper(trim(coalesce(p_code, '')));
  IF v_clean = '' THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  SELECT id, agent_code, full_name, is_active
  INTO v_agent
  FROM public.sales_agents
  WHERE upper(agent_code) = v_clean;

  IF v_agent.id IS NULL OR NOT v_agent.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or inactive partner referral code.');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'agent_code', v_agent.agent_code,
    'agent_name', v_agent.full_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO authenticated, anon;

-- 10. Attach Referral Code to Newly Registered Institute
CREATE OR REPLACE FUNCTION public.attach_referral_to_institute(
  p_login_id text,
  p_referral_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_code text;
  v_clean_login text;
  v_agent record;
  v_org_id uuid;
BEGIN
  v_clean_code := upper(trim(coalesce(p_referral_code, '')));
  v_clean_login := upper(trim(coalesce(p_login_id, '')));

  IF v_clean_code = '' OR v_clean_login = '' THEN
    RETURN jsonb_build_object('attached', false);
  END IF;

  SELECT id, agent_code, full_name, is_active
  INTO v_agent
  FROM public.sales_agents
  WHERE upper(agent_code) = v_clean_code;

  IF v_agent.id IS NULL OR NOT v_agent.is_active THEN
    RETURN jsonb_build_object('attached', false, 'error', 'Referral code is invalid or inactive.');
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE upper(login_id) = v_clean_login
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('attached', false, 'error', 'Institution profile not found.');
  END IF;

  UPDATE public.organizations
  SET
    referred_by_agent_id = v_agent.id,
    referred_at = coalesce(referred_at, now()),
    referral_code_used = v_agent.agent_code
  WHERE id = v_org_id
    AND referred_by_agent_id IS NULL;

  RETURN jsonb_build_object(
    'attached', true,
    'organization_id', v_org_id,
    'agent_code', v_agent.agent_code,
    'agent_name', v_agent.full_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_referral_to_institute(text, text) TO authenticated, anon;

-- 11. Enhanced Submit Subscription Payment (Supports Joining Fee vs Monthly Recurring vs Combined)
DROP FUNCTION IF EXISTS public.submit_subscription_payment(uuid, integer, numeric, text, text);
DROP FUNCTION IF EXISTS public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text);

CREATE OR REPLACE FUNCTION public.submit_subscription_payment(
  p_org_id uuid,
  p_student_limit integer,
  p_amount numeric,
  p_utr_number text,
  p_screenshot_url text DEFAULT null,
  p_payment_category text DEFAULT 'recurring',
  p_joining_fee_portion numeric DEFAULT 0,
  p_notes text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_utr text;
  v_cat text;
  v_joining numeric;
  v_payment_id uuid;
BEGIN
  IF p_org_id != public.user_org_id() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  v_clean_utr := trim(coalesce(p_utr_number, ''));
  IF v_clean_utr = '' THEN
    RAISE EXCEPTION 'UTR / Transaction Reference number is required.';
  END IF;

  IF p_student_limit < 1 THEN
    RAISE EXCEPTION 'Student limit must be at least 1.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.';
  END IF;

  v_cat := lower(trim(coalesce(p_payment_category, 'recurring')));
  IF v_cat NOT IN ('joining_fee', 'recurring', 'combined') THEN
    v_cat := 'recurring';
  END IF;

  v_joining := greatest(0, least(p_amount, coalesce(p_joining_fee_portion, 0)));
  IF v_cat = 'joining_fee' THEN
    v_joining := p_amount;
  ELSIF v_cat = 'recurring' THEN
    v_joining := 0;
  END IF;

  INSERT INTO public.subscription_payments (
    organization_id, requested_by, student_limit, amount, utr_number, screenshot_url,
    status, payment_category, joining_fee_portion, notes
  ) VALUES (
    p_org_id, auth.uid(), p_student_limit, p_amount, v_clean_utr, p_screenshot_url,
    'pending', v_cat, v_joining, nullif(trim(coalesce(p_notes, '')), '')
  ) RETURNING id INTO v_payment_id;

  UPDATE public.institution_subscriptions
  SET
    status = 'pending_approval',
    updated_at = now()
  WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'payment_category', v_cat,
    'message', 'Payment proof submitted successfully. Super Admin will verify and activate your subscription.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text) TO authenticated;

-- 12. Internal Helper: Credit Agent Commission for an Approved Payment (Idempotent)
CREATE OR REPLACE FUNCTION public._credit_agent_commission_for_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay record;
  v_org record;
  v_agent record;
  v_cat text;
  v_join_gross numeric(12,2) := 0;
  v_rec_gross numeric(12,2) := 0;
  v_join_comm numeric(12,2) := 0;
  v_rec_comm numeric(12,2) := 0;
  v_total_credited numeric(12,2) := 0;
BEGIN
  SELECT * INTO v_pay FROM public.subscription_payments WHERE id = p_payment_id;
  IF v_pay.id IS NULL OR v_pay.status <> 'approved' THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Payment not approved.');
  END IF;

  SELECT id, name, referred_by_agent_id INTO v_org
  FROM public.organizations
  WHERE id = v_pay.organization_id;

  IF v_org.id IS NULL OR v_org.referred_by_agent_id IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'No sales agent linked to this school.');
  END IF;

  SELECT * INTO v_agent FROM public.sales_agents WHERE id = v_org.referred_by_agent_id;
  IF v_agent.id IS NULL OR NOT v_agent.is_active THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Linked agent is inactive.');
  END IF;

  v_cat := coalesce(v_pay.payment_category, 'recurring');

  IF v_cat = 'joining_fee' THEN
    v_join_gross := v_pay.amount;
    v_rec_gross := 0;
  ELSIF v_cat = 'combined' THEN
    v_join_gross := greatest(0, least(v_pay.amount, coalesce(v_pay.joining_fee_portion, 0)));
    v_rec_gross := greatest(0, v_pay.amount - v_join_gross);
  ELSE
    v_join_gross := 0;
    v_rec_gross := v_pay.amount;
  END IF;

  -- Credit One-Time Joining Fee Commission (default 50% or agent custom rate)
  IF v_join_gross > 0 AND v_agent.joining_commission_percent > 0 THEN
    v_join_comm := round((v_join_gross * v_agent.joining_commission_percent) / 100.0, 2);
    IF v_join_comm > 0 THEN
      INSERT INTO public.agent_commissions (
        agent_id, organization_id, organization_name, source_payment_id,
        commission_type, gross_payment_amount, commission_percent, commission_amount,
        reference_utr, notes
      ) VALUES (
        v_agent.id, v_org.id, v_org.name, v_pay.id,
        'joining_fee', v_join_gross, v_agent.joining_commission_percent, v_join_comm,
        v_pay.utr_number, 'One-time joining/setup fee commission'
      )
      ON CONFLICT (source_payment_id, commission_type) WHERE source_payment_id IS NOT NULL
      DO NOTHING;
      v_total_credited := v_total_credited + v_join_comm;
    END IF;
  END IF;

  -- Credit Monthly Recurring Commission (agent variable rate)
  IF v_rec_gross > 0 AND v_agent.recurring_commission_percent > 0 THEN
    v_rec_comm := round((v_rec_gross * v_agent.recurring_commission_percent) / 100.0, 2);
    IF v_rec_comm > 0 THEN
      INSERT INTO public.agent_commissions (
        agent_id, organization_id, organization_name, source_payment_id,
        commission_type, gross_payment_amount, commission_percent, commission_amount,
        reference_utr, notes
      ) VALUES (
        v_agent.id, v_org.id, v_org.name, v_pay.id,
        'recurring', v_rec_gross, v_agent.recurring_commission_percent, v_rec_comm,
        v_pay.utr_number, 'Monthly subscription recurring commission'
      )
      ON CONFLICT (source_payment_id, commission_type) WHERE source_payment_id IS NOT NULL
      DO NOTHING;
      v_total_credited := v_total_credited + v_rec_comm;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'credited', true,
    'agent_id', v_agent.id,
    'agent_name', v_agent.full_name,
    'agent_code', v_agent.agent_code,
    'joining_commission', v_join_comm,
    'recurring_commission', v_rec_comm,
    'total_commission', v_total_credited
  );
END;
$$;

-- 13. Enhanced Approve Subscription Payment (Supports master code, category split, auto-commission)
DROP FUNCTION IF EXISTS public.approve_subscription_payment(uuid, integer);
DROP FUNCTION IF EXISTS public.approve_subscription_payment(uuid, integer, text);
DROP FUNCTION IF EXISTS public.approve_subscription_payment(uuid, integer, text, text, numeric);

CREATE OR REPLACE FUNCTION public.approve_subscription_payment(
  p_payment_id uuid,
  p_duration_days integer DEFAULT 30,
  p_master_code text DEFAULT null,
  p_payment_category text DEFAULT null,
  p_joining_fee_portion numeric DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay record;
  v_curr_end timestamptz;
  v_new_end timestamptz;
  v_final_cat text;
  v_final_join numeric;
  v_monthly_amt numeric;
  v_comm_result jsonb;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform super administrators can approve subscription payments.';
  END IF;

  SELECT * INTO v_pay FROM public.subscription_payments WHERE id = p_payment_id;
  IF v_pay.id IS NULL THEN
    RAISE EXCEPTION 'Payment record not found.';
  END IF;

  v_final_cat := coalesce(nullif(lower(trim(p_payment_category)), ''), v_pay.payment_category, 'recurring');
  IF v_final_cat NOT IN ('joining_fee', 'recurring', 'combined') THEN
    v_final_cat := 'recurring';
  END IF;

  v_final_join := coalesce(p_joining_fee_portion, v_pay.joining_fee_portion, 0);
  IF v_final_cat = 'joining_fee' THEN
    v_final_join := v_pay.amount;
  ELSIF v_final_cat = 'recurring' THEN
    v_final_join := 0;
  ELSE
    v_final_join := greatest(0, least(v_pay.amount, v_final_join));
  END IF;

  UPDATE public.subscription_payments
  SET
    status = 'approved',
    payment_category = v_final_cat,
    joining_fee_portion = v_final_join,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    rejection_reason = null,
    updated_at = now()
  WHERE id = p_payment_id;

  SELECT current_period_ends_at INTO v_curr_end
  FROM public.institution_subscriptions
  WHERE organization_id = v_pay.organization_id;

  IF coalesce(p_duration_days, 30) > 0 THEN
    IF v_curr_end IS NULL OR v_curr_end < now() THEN
      v_new_end := now() + (p_duration_days * interval '1 day');
    ELSE
      v_new_end := v_curr_end + (p_duration_days * interval '1 day');
    END IF;

    v_monthly_amt := CASE
      WHEN v_final_cat = 'combined' THEN greatest(0, v_pay.amount - v_final_join)
      ELSE v_pay.amount
    END;

    UPDATE public.institution_subscriptions
    SET
      plan_type = 'standard',
      status = 'active',
      is_trial = false,
      is_paused = false,
      pause_reason = null,
      paused_at = null,
      student_limit = greatest(coalesce(v_pay.student_limit, student_limit), 1),
      monthly_amount = CASE WHEN v_monthly_amt > 0 THEN v_monthly_amt ELSE monthly_amount END,
      current_period_starts_at = now(),
      current_period_ends_at = v_new_end,
      updated_at = now()
    WHERE organization_id = v_pay.organization_id;
  ELSE
    v_new_end := v_curr_end;
    -- Revert pending_approval status if joining fee only without extending days
    UPDATE public.institution_subscriptions
    SET
      status = CASE
        WHEN current_period_ends_at < now() THEN 'expired'
        WHEN is_trial THEN 'trial'
        ELSE 'active'
      END,
      updated_at = now()
    WHERE organization_id = v_pay.organization_id
      AND status = 'pending_approval';
  END IF;

  -- Unpause organization if paused
  UPDATE public.organizations
  SET is_paused = false, pause_reason = null, paused_at = null
  WHERE id = v_pay.organization_id AND is_paused = true;

  -- Automatically credit linked sales agent commission!
  v_comm_result := public._credit_agent_commission_for_payment(p_payment_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Payment approved successfully.',
    'new_period_ends_at', v_new_end,
    'student_limit', v_pay.student_limit,
    'commission', v_comm_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_subscription_payment(uuid, integer, text, text, numeric) TO authenticated, anon;

-- 14. Fix Reject Subscription Payment to support p_master_code cleanly
DROP FUNCTION IF EXISTS public.reject_subscription_payment(uuid, text);
DROP FUNCTION IF EXISTS public.reject_subscription_payment(uuid, text, text);

CREATE OR REPLACE FUNCTION public.reject_subscription_payment(
  p_payment_id uuid,
  p_reason text,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay record;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform super administrators can reject subscription payments.';
  END IF;

  SELECT * INTO v_pay FROM public.subscription_payments WHERE id = p_payment_id;
  IF v_pay.id IS NULL THEN
    RAISE EXCEPTION 'Payment record not found.';
  END IF;

  UPDATE public.subscription_payments
  SET
    status = 'rejected',
    rejection_reason = coalesce(nullif(trim(p_reason), ''), 'Payment could not be verified. Please check UTR and re-submit.'),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_payment_id;

  UPDATE public.institution_subscriptions
  SET
    status = CASE
      WHEN current_period_ends_at < now() THEN 'expired'
      WHEN is_trial THEN 'trial'
      ELSE 'active'
    END,
    updated_at = now()
  WHERE organization_id = v_pay.organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Subscription payment request rejected.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_subscription_payment(uuid, text, text) TO authenticated, anon;

-- 15. Super Admin Direct Payment Recorder (For Cash/Direct Joining Fee or Monthly Fee collected offline)
CREATE OR REPLACE FUNCTION public.admin_record_direct_school_payment(
  p_org_id uuid,
  p_amount numeric,
  p_payment_category text DEFAULT 'joining_fee',
  p_duration_days integer DEFAULT 0,
  p_student_limit integer DEFAULT null,
  p_utr_number text DEFAULT 'DIRECT-ADMIN-ENTRY',
  p_joining_fee_portion numeric DEFAULT 0,
  p_notes text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_limit integer;
  v_cat text;
  v_joining numeric;
  v_payment_id uuid;
  v_approve_res jsonb;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.';
  END IF;

  SELECT * INTO v_sub FROM public.institution_subscriptions WHERE organization_id = p_org_id;
  v_limit := greatest(1, coalesce(p_student_limit, v_sub.student_limit, 100));

  v_cat := lower(trim(coalesce(p_payment_category, 'joining_fee')));
  IF v_cat NOT IN ('joining_fee', 'recurring', 'combined') THEN
    v_cat := 'joining_fee';
  END IF;

  v_joining := CASE
    WHEN v_cat = 'joining_fee' THEN p_amount
    WHEN v_cat = 'combined' THEN greatest(0, least(p_amount, coalesce(p_joining_fee_portion, 0)))
    ELSE 0
  END;

  INSERT INTO public.subscription_payments (
    organization_id, requested_by, student_limit, amount, payment_method, utr_number,
    status, payment_category, joining_fee_portion, notes
  ) VALUES (
    p_org_id, auth.uid(), v_limit, p_amount, 'manual_admin',
    coalesce(nullif(trim(p_utr_number), ''), 'DIRECT-' || to_char(now(), 'YYYYMMDD-HH24MI')),
    'pending', v_cat, v_joining, nullif(trim(coalesce(p_notes, '')), '')
  ) RETURNING id INTO v_payment_id;

  v_approve_res := public.approve_subscription_payment(
    v_payment_id,
    coalesce(p_duration_days, CASE WHEN v_cat = 'joining_fee' THEN 0 ELSE 30 END),
    p_master_code,
    v_cat,
    v_joining
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'approval', v_approve_res
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_record_direct_school_payment(uuid, numeric, text, integer, integer, text, numeric, text, text) TO authenticated, anon;

-- 16. Super Admin Agent Management RPCs
CREATE OR REPLACE FUNCTION public.admin_create_sales_agent(
  p_full_name text,
  p_phone text,
  p_email text,
  p_agent_code text,
  p_password text,
  p_joining_percent numeric DEFAULT 50.00,
  p_recurring_percent numeric DEFAULT 20.00,
  p_upi_id text DEFAULT null,
  p_bank_details text DEFAULT null,
  p_city text DEFAULT null,
  p_notes text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_email text;
  v_salt text;
  v_hash text;
  v_agent_id uuid;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  v_code := upper(regexp_replace(trim(coalesce(p_agent_code, '')), '[^A-Za-z0-9_-]', '', 'g'));
  IF v_code = '' OR length(v_code) < 3 THEN
    RAISE EXCEPTION 'Agent code must be at least 3 alphanumeric characters.';
  END IF;

  IF length(trim(coalesce(p_full_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Agent full name is required.';
  END IF;

  IF length(trim(coalesce(p_phone, ''))) < 6 THEN
    RAISE EXCEPTION 'Valid phone number is required.';
  END IF;

  IF length(coalesce(p_password, '')) < 6 THEN
    RAISE EXCEPTION 'Agent login password must be at least 6 characters.';
  END IF;

  IF p_joining_percent < 0 OR p_joining_percent > 100 OR p_recurring_percent < 0 OR p_recurring_percent > 100 THEN
    RAISE EXCEPTION 'Commission percentages must be between 0 and 100.';
  END IF;

  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  IF EXISTS (SELECT 1 FROM public.sales_agents WHERE upper(agent_code) = v_code) THEN
    RAISE EXCEPTION 'Agent code "%" already exists. Choose a different code.', v_code;
  END IF;

  IF v_email IS NOT NULL AND EXISTS (SELECT 1 FROM public.sales_agents WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'An agent with email "%" already exists.', v_email;
  END IF;

  v_salt := gen_random_uuid()::text;
  v_hash := public._hash_agent_password(v_salt, p_password);

  INSERT INTO public.sales_agents (
    full_name, phone, email, agent_code, password_salt, password_hash,
    joining_commission_percent, recurring_commission_percent,
    upi_id, bank_details, city, notes, is_active
  ) VALUES (
    trim(p_full_name), trim(p_phone), v_email, v_code, v_salt, v_hash,
    round(p_joining_percent, 2), round(p_recurring_percent, 2),
    nullif(trim(coalesce(p_upi_id, '')), ''),
    nullif(trim(coalesce(p_bank_details, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    true
  ) RETURNING id INTO v_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'agent_id', v_agent_id,
    'agent_code', v_code,
    'message', format('Sales Agent "%s" (%s) created successfully.', trim(p_full_name), v_code)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_sales_agent(text, text, text, text, text, numeric, numeric, text, text, text, text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.admin_update_sales_agent(
  p_agent_id uuid,
  p_full_name text,
  p_phone text,
  p_email text DEFAULT null,
  p_joining_percent numeric DEFAULT 50.00,
  p_recurring_percent numeric DEFAULT 20.00,
  p_upi_id text DEFAULT null,
  p_bank_details text DEFAULT null,
  p_city text DEFAULT null,
  p_notes text DEFAULT null,
  p_is_active boolean DEFAULT true,
  p_new_password text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_salt text;
  v_hash text;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  IF p_joining_percent < 0 OR p_joining_percent > 100 OR p_recurring_percent < 0 OR p_recurring_percent > 100 THEN
    RAISE EXCEPTION 'Commission percentages must be between 0 and 100.';
  END IF;

  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sales_agents WHERE lower(email) = v_email AND id <> p_agent_id
  ) THEN
    RAISE EXCEPTION 'Another agent already uses email "%".', v_email;
  END IF;

  IF p_new_password IS NOT NULL AND trim(p_new_password) <> '' THEN
    IF length(trim(p_new_password)) < 6 THEN
      RAISE EXCEPTION 'New password must be at least 6 characters.';
    END IF;
    v_salt := gen_random_uuid()::text;
    v_hash := public._hash_agent_password(v_salt, trim(p_new_password));

    UPDATE public.sales_agents
    SET
      full_name = trim(p_full_name),
      phone = trim(p_phone),
      email = v_email,
      joining_commission_percent = round(p_joining_percent, 2),
      recurring_commission_percent = round(p_recurring_percent, 2),
      upi_id = nullif(trim(coalesce(p_upi_id, '')), ''),
      bank_details = nullif(trim(coalesce(p_bank_details, '')), ''),
      city = nullif(trim(coalesce(p_city, '')), ''),
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      is_active = coalesce(p_is_active, true),
      password_salt = v_salt,
      password_hash = v_hash,
      updated_at = now()
    WHERE id = p_agent_id;
  ELSE
    UPDATE public.sales_agents
    SET
      full_name = trim(p_full_name),
      phone = trim(p_phone),
      email = v_email,
      joining_commission_percent = round(p_joining_percent, 2),
      recurring_commission_percent = round(p_recurring_percent, 2),
      upi_id = nullif(trim(coalesce(p_upi_id, '')), ''),
      bank_details = nullif(trim(coalesce(p_bank_details, '')), ''),
      city = nullif(trim(coalesce(p_city, '')), ''),
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      is_active = coalesce(p_is_active, true),
      updated_at = now()
    WHERE id = p_agent_id;
  END IF;

  IF NOT coalesce(p_is_active, true) THEN
    DELETE FROM public.sales_agent_sessions WHERE agent_id = p_agent_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Agent profile and commission rules updated.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_sales_agent(uuid, text, text, text, numeric, numeric, text, text, text, text, boolean, text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.admin_delete_sales_agent(
  p_agent_id uuid,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  UPDATE public.organizations
  SET referred_by_agent_id = NULL
  WHERE referred_by_agent_id = p_agent_id;

  DELETE FROM public.sales_agents WHERE id = p_agent_id;

  RETURN jsonb_build_object('success', true, 'message', 'Sales agent permanently removed.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_sales_agent(uuid, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.admin_assign_agent_to_institution(
  p_org_id uuid,
  p_agent_id uuid DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := NULL;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  IF p_agent_id IS NOT NULL THEN
    SELECT agent_code INTO v_code FROM public.sales_agents WHERE id = p_agent_id;
    IF v_code IS NULL THEN
      RAISE EXCEPTION 'Selected sales agent not found.';
    END IF;
  END IF;

  UPDATE public.organizations
  SET
    referred_by_agent_id = p_agent_id,
    referred_at = CASE WHEN p_agent_id IS NOT NULL THEN coalesce(referred_at, now()) ELSE NULL END,
    referral_code_used = v_code
  WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'referred_by_agent_id', p_agent_id,
    'referral_code_used', v_code,
    'message', CASE WHEN p_agent_id IS NOT NULL THEN 'School linked to sales agent successfully.' ELSE 'School unlinked from sales agent.' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_agent_to_institution(uuid, uuid, text) TO authenticated, anon;

-- 17. Super Admin Record Payout to Agent
CREATE OR REPLACE FUNCTION public.admin_record_agent_payout(
  p_agent_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'upi',
  p_reference_no text DEFAULT null,
  p_paid_for_month text DEFAULT null,
  p_notes text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout_id uuid;
  v_earned numeric := 0;
  v_paid numeric := 0;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payout amount must be greater than zero.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sales_agents WHERE id = p_agent_id) THEN
    RAISE EXCEPTION 'Agent not found.';
  END IF;

  INSERT INTO public.agent_payouts (
    agent_id, amount, payment_method, reference_no, paid_for_month, notes
  ) VALUES (
    p_agent_id, round(p_amount, 2), coalesce(nullif(trim(p_payment_method), ''), 'upi'),
    nullif(trim(coalesce(p_reference_no, '')), ''),
    nullif(trim(coalesce(p_paid_for_month, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  ) RETURNING id INTO v_payout_id;

  SELECT coalesce(sum(commission_amount), 0) INTO v_earned FROM public.agent_commissions WHERE agent_id = p_agent_id;
  SELECT coalesce(sum(amount), 0) INTO v_paid FROM public.agent_payouts WHERE agent_id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'total_earned', v_earned,
    'total_paid', v_paid,
    'pending_balance', v_earned - v_paid,
    'message', format('Payout of ₹%s recorded successfully.', round(p_amount, 2))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_record_agent_payout(uuid, numeric, text, text, text, text, text) TO authenticated, anon;

-- 18. Super Admin Manual Commission Adjustment / Bonus
CREATE OR REPLACE FUNCTION public.admin_add_manual_commission(
  p_agent_id uuid,
  p_org_id uuid DEFAULT null,
  p_commission_type text DEFAULT 'bonus_adjustment',
  p_gross_amount numeric DEFAULT 0,
  p_commission_percent numeric DEFAULT 0,
  p_commission_amount numeric DEFAULT 0,
  p_notes text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name text := 'Platform Adjustment / Bonus';
  v_type text;
  v_comm_id uuid;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  IF p_commission_amount IS NULL OR p_commission_amount = 0 THEN
    RAISE EXCEPTION 'Commission amount cannot be zero.';
  END IF;

  v_type := lower(trim(coalesce(p_commission_type, 'bonus_adjustment')));
  IF v_type NOT IN ('joining_fee', 'recurring', 'bonus_adjustment') THEN
    v_type := 'bonus_adjustment';
  END IF;

  IF p_org_id IS NOT NULL THEN
    SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
    v_org_name := coalesce(v_org_name, 'Selected Institution');
  END IF;

  INSERT INTO public.agent_commissions (
    agent_id, organization_id, organization_name, source_payment_id,
    commission_type, gross_payment_amount, commission_percent, commission_amount,
    reference_utr, notes
  ) VALUES (
    p_agent_id, p_org_id, v_org_name, NULL,
    v_type, coalesce(p_gross_amount, 0), coalesce(p_commission_percent, 0), round(p_commission_amount, 2),
    'MANUAL-ADMIN', nullif(trim(coalesce(p_notes, '')), '')
  ) RETURNING id INTO v_comm_id;

  RETURN jsonb_build_object(
    'success', true,
    'commission_id', v_comm_id,
    'message', 'Manual commission entry added to agent wallet.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_manual_commission(uuid, uuid, text, numeric, numeric, numeric, text, text) TO authenticated, anon;

-- 19. Super Admin Full Agents & Payouts Dashboard RPC
CREATE OR REPLACE FUNCTION public.admin_list_sales_agents_dashboard(p_master_code text DEFAULT null)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agents jsonb;
  v_commissions jsonb;
  v_payouts jsonb;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_agents
  FROM (
    SELECT jsonb_build_object(
      'id', a.id,
      'full_name', a.full_name,
      'phone', a.phone,
      'email', a.email,
      'agent_code', a.agent_code,
      'joining_commission_percent', a.joining_commission_percent,
      'recurring_commission_percent', a.recurring_commission_percent,
      'upi_id', a.upi_id,
      'bank_details', a.bank_details,
      'city', a.city,
      'notes', a.notes,
      'is_active', a.is_active,
      'created_at', a.created_at,
      'total_schools', coalesce(s.total_schools, 0),
      'active_paid_schools', coalesce(s.active_paid_schools, 0),
      'trial_schools', coalesce(s.trial_schools, 0),
      'total_revenue_generated', coalesce(c.gross_total, 0),
      'joining_earned', coalesce(c.joining_earned, 0),
      'recurring_earned', coalesce(c.recurring_earned, 0),
      'bonus_earned', coalesce(c.bonus_earned, 0),
      'total_earned', coalesce(c.total_earned, 0),
      'total_paid_out', coalesce(p.total_paid, 0),
      'pending_balance', coalesce(c.total_earned, 0) - coalesce(p.total_paid, 0)
    ) AS row_data,
    a.created_at
    FROM public.sales_agents a
    LEFT JOIN (
      SELECT
        o.referred_by_agent_id,
        count(*) AS total_schools,
        count(*) FILTER (
          WHERE sub.status = 'active' AND NOT coalesce(sub.is_trial, true) AND NOT coalesce(o.is_paused, false)
        ) AS active_paid_schools,
        count(*) FILTER (
          WHERE coalesce(sub.is_trial, true)
        ) AS trial_schools
      FROM public.organizations o
      LEFT JOIN public.institution_subscriptions sub ON sub.organization_id = o.id
      WHERE o.referred_by_agent_id IS NOT NULL
      GROUP BY o.referred_by_agent_id
    ) s ON s.referred_by_agent_id = a.id
    LEFT JOIN (
      SELECT
        agent_id,
        coalesce(sum(gross_payment_amount), 0) AS gross_total,
        coalesce(sum(commission_amount) FILTER (WHERE commission_type = 'joining_fee'), 0) AS joining_earned,
        coalesce(sum(commission_amount) FILTER (WHERE commission_type = 'recurring'), 0) AS recurring_earned,
        coalesce(sum(commission_amount) FILTER (WHERE commission_type = 'bonus_adjustment'), 0) AS bonus_earned,
        coalesce(sum(commission_amount), 0) AS total_earned
      FROM public.agent_commissions
      GROUP BY agent_id
    ) c ON c.agent_id = a.id
    LEFT JOIN (
      SELECT
        agent_id,
        coalesce(sum(amount), 0) AS total_paid
      FROM public.agent_payouts
      GROUP BY agent_id
    ) p ON p.agent_id = a.id
  ) subq;

  SELECT coalesce(jsonb_agg(c_row), '[]'::jsonb)
  INTO v_commissions
  FROM (
    SELECT jsonb_build_object(
      'id', ac.id,
      'agent_id', ac.agent_id,
      'agent_name', a.full_name,
      'agent_code', a.agent_code,
      'organization_id', ac.organization_id,
      'organization_name', ac.organization_name,
      'commission_type', ac.commission_type,
      'gross_payment_amount', ac.gross_payment_amount,
      'commission_percent', ac.commission_percent,
      'commission_amount', ac.commission_amount,
      'reference_utr', ac.reference_utr,
      'notes', ac.notes,
      'created_at', ac.created_at
    ) AS c_row
    FROM public.agent_commissions ac
    JOIN public.sales_agents a ON a.id = ac.agent_id
    ORDER BY ac.created_at DESC
    LIMIT 100
  ) c_sub;

  SELECT coalesce(jsonb_agg(p_row), '[]'::jsonb)
  INTO v_payouts
  FROM (
    SELECT jsonb_build_object(
      'id', ap.id,
      'agent_id', ap.agent_id,
      'agent_name', a.full_name,
      'agent_code', a.agent_code,
      'amount', ap.amount,
      'payment_method', ap.payment_method,
      'reference_no', ap.reference_no,
      'paid_for_month', ap.paid_for_month,
      'notes', ap.notes,
      'paid_at', ap.paid_at
    ) AS p_row
    FROM public.agent_payouts ap
    JOIN public.sales_agents a ON a.id = ap.agent_id
    ORDER BY ap.paid_at DESC
    LIMIT 100
  ) p_sub;

  RETURN jsonb_build_object(
    'agents', v_agents,
    'commissions', v_commissions,
    'payouts', v_payouts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_sales_agents_dashboard(text) TO authenticated, anon;

-- 20. Dedicated Agent Login Portal RPCs
CREATE OR REPLACE FUNCTION public.agent_login(
  p_identifier text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ident text;
  v_digits text;
  v_agent record;
  v_hash text;
  v_token text;
BEGIN
  v_ident := trim(coalesce(p_identifier, ''));
  v_digits := regexp_replace(v_ident, '\D', '', 'g');

  IF v_ident = '' OR coalesce(p_password, '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent Code / Email / Phone and Password are required.');
  END IF;

  SELECT * INTO v_agent
  FROM public.sales_agents
  WHERE upper(agent_code) = upper(v_ident)
     OR (email IS NOT NULL AND lower(email) = lower(v_ident))
     OR (length(v_digits) >= 8 AND regexp_replace(phone, '\D', '', 'g') = v_digits)
  LIMIT 1;

  IF v_agent.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid partner login credentials.');
  END IF;

  v_hash := public._hash_agent_password(v_agent.password_salt, p_password);
  IF v_hash <> v_agent.password_hash THEN
    RETURN jsonb_build_object('success', false, 'error', 'Incorrect password. Contact Super Admin if you need a reset.');
  END IF;

  IF NOT v_agent.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your sales partner account has been paused by EduTechLab Admin.');
  END IF;

  -- Clean expired sessions for this agent
  DELETE FROM public.sales_agent_sessions
  WHERE agent_id = v_agent.id AND expires_at < now();

  v_token := encode(sha256((gen_random_uuid()::text || ':' || clock_timestamp()::text || ':' || v_agent.id::text)::bytea), 'hex');

  INSERT INTO public.sales_agent_sessions (agent_id, session_token, expires_at)
  VALUES (v_agent.id, v_token, now() + interval '7 days');

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'agent', jsonb_build_object(
      'id', v_agent.id,
      'full_name', v_agent.full_name,
      'agent_code', v_agent.agent_code,
      'email', v_agent.email,
      'phone', v_agent.phone
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_login(text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_agent_portal_dashboard(p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_agent record;
  v_schools jsonb;
  v_commissions jsonb;
  v_payouts jsonb;
  v_total_earned numeric := 0;
  v_joining_earned numeric := 0;
  v_recurring_earned numeric := 0;
  v_bonus_earned numeric := 0;
  v_total_paid numeric := 0;
  v_total_revenue numeric := 0;
  v_settings record;
BEGIN
  IF trim(coalesce(p_session_token, '')) = '' THEN
    RETURN jsonb_build_object('authenticated', false, 'error', 'Session token missing.');
  END IF;

  SELECT * INTO v_session
  FROM public.sales_agent_sessions
  WHERE session_token = trim(p_session_token) AND expires_at > now();

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('authenticated', false, 'error', 'Session expired or invalid. Please sign in again.');
  END IF;

  SELECT * INTO v_agent FROM public.sales_agents WHERE id = v_session.agent_id;
  IF v_agent.id IS NULL OR NOT v_agent.is_active THEN
    RETURN jsonb_build_object('authenticated', false, 'error', 'Partner account is inactive.');
  END IF;

  SELECT contact_phone, whatsapp_number, contact_email, brand_name, standard_rate, pro_rate
  INTO v_settings
  FROM public.platform_settings
  WHERE id = 'global';

  SELECT
    coalesce(sum(commission_amount), 0),
    coalesce(sum(commission_amount) FILTER (WHERE commission_type = 'joining_fee'), 0),
    coalesce(sum(commission_amount) FILTER (WHERE commission_type = 'recurring'), 0),
    coalesce(sum(commission_amount) FILTER (WHERE commission_type = 'bonus_adjustment'), 0),
    coalesce(sum(gross_payment_amount), 0)
  INTO v_total_earned, v_joining_earned, v_recurring_earned, v_bonus_earned, v_total_revenue
  FROM public.agent_commissions
  WHERE agent_id = v_agent.id;

  SELECT coalesce(sum(amount), 0)
  INTO v_total_paid
  FROM public.agent_payouts
  WHERE agent_id = v_agent.id;

  SELECT coalesce(jsonb_agg(s_row), '[]'::jsonb)
  INTO v_schools
  FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'created_at', coalesce(o.referred_at, o.created_at),
      'is_paused', coalesce(o.is_paused, false),
      'is_active', coalesce(o.is_active, true),
      'student_count', coalesce(stu.cnt, 0),
      'student_limit', coalesce(sub.student_limit, 20),
      'plan_type', coalesce(sub.plan_type, 'trial'),
      'is_trial', coalesce(sub.is_trial, true),
      'sub_status', coalesce(sub.status, 'trial'),
      'monthly_amount', coalesce(sub.monthly_amount, 0),
      'valid_until', sub.current_period_ends_at,
      'total_school_paid', coalesce(sc.gross_sum, 0),
      'agent_earned_from_school', coalesce(sc.comm_sum, 0)
    ) AS s_row
    FROM public.organizations o
    LEFT JOIN public.institution_subscriptions sub ON sub.organization_id = o.id
    LEFT JOIN (
      SELECT organization_id, count(*) AS cnt
      FROM public.students
      WHERE status = 'active'
      GROUP BY organization_id
    ) stu ON stu.organization_id = o.id
    LEFT JOIN (
      SELECT organization_id, sum(gross_payment_amount) AS gross_sum, sum(commission_amount) AS comm_sum
      FROM public.agent_commissions
      WHERE agent_id = v_agent.id
      GROUP BY organization_id
    ) sc ON sc.organization_id = o.id
    WHERE o.referred_by_agent_id = v_agent.id
    ORDER BY coalesce(o.referred_at, o.created_at) DESC
  ) s_sub;

  SELECT coalesce(jsonb_agg(c_row), '[]'::jsonb)
  INTO v_commissions
  FROM (
    SELECT jsonb_build_object(
      'id', ac.id,
      'organization_name', ac.organization_name,
      'commission_type', ac.commission_type,
      'gross_payment_amount', ac.gross_payment_amount,
      'commission_percent', ac.commission_percent,
      'commission_amount', ac.commission_amount,
      'reference_utr', ac.reference_utr,
      'notes', ac.notes,
      'created_at', ac.created_at
    ) AS c_row
    FROM public.agent_commissions ac
    WHERE ac.agent_id = v_agent.id
    ORDER BY ac.created_at DESC
    LIMIT 100
  ) c_sub;

  SELECT coalesce(jsonb_agg(p_row), '[]'::jsonb)
  INTO v_payouts
  FROM (
    SELECT jsonb_build_object(
      'id', ap.id,
      'amount', ap.amount,
      'payment_method', ap.payment_method,
      'reference_no', ap.reference_no,
      'paid_for_month', ap.paid_for_month,
      'notes', ap.notes,
      'paid_at', ap.paid_at
    ) AS p_row
    FROM public.agent_payouts ap
    WHERE ap.agent_id = v_agent.id
    ORDER BY ap.paid_at DESC
    LIMIT 100
  ) p_sub;

  RETURN jsonb_build_object(
    'authenticated', true,
    'agent', jsonb_build_object(
      'id', v_agent.id,
      'full_name', v_agent.full_name,
      'agent_code', v_agent.agent_code,
      'email', v_agent.email,
      'phone', v_agent.phone,
      'city', v_agent.city,
      'joining_commission_percent', v_agent.joining_commission_percent,
      'recurring_commission_percent', v_agent.recurring_commission_percent,
      'upi_id', v_agent.upi_id,
      'bank_details', v_agent.bank_details,
      'created_at', v_agent.created_at
    ),
    'wallet', jsonb_build_object(
      'total_earned', v_total_earned,
      'joining_earned', v_joining_earned,
      'recurring_earned', v_recurring_earned,
      'bonus_earned', v_bonus_earned,
      'total_paid', v_total_paid,
      'pending_balance', v_total_earned - v_total_paid,
      'total_revenue_generated', v_total_revenue
    ),
    'schools', v_schools,
    'commissions', v_commissions,
    'payouts', v_payouts,
    'platform_contact', jsonb_build_object(
      'brand_name', coalesce(v_settings.brand_name, 'EduTechLab'),
      'contact_phone', v_settings.contact_phone,
      'whatsapp_number', v_settings.whatsapp_number,
      'contact_email', v_settings.contact_email,
      'standard_rate', coalesce(v_settings.standard_rate, 5),
      'pro_rate', coalesce(v_settings.pro_rate, 7)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_portal_dashboard(text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.agent_update_payout_details(
  p_session_token text,
  p_upi_id text DEFAULT null,
  p_bank_details text DEFAULT null,
  p_phone text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
BEGIN
  SELECT agent_id INTO v_agent_id
  FROM public.sales_agent_sessions
  WHERE session_token = trim(coalesce(p_session_token, '')) AND expires_at > now();

  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Session expired. Please log in again.';
  END IF;

  UPDATE public.sales_agents
  SET
    upi_id = nullif(trim(coalesce(p_upi_id, '')), ''),
    bank_details = nullif(trim(coalesce(p_bank_details, '')), ''),
    phone = coalesce(nullif(trim(coalesce(p_phone, '')), ''), phone),
    updated_at = now()
  WHERE id = v_agent_id;

  RETURN jsonb_build_object('success', true, 'message', 'Your payout details have been updated.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_update_payout_details(text, text, text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.agent_change_password(
  p_session_token text,
  p_old_password text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent record;
  v_agent_id uuid;
  v_new_salt text;
BEGIN
  SELECT agent_id INTO v_agent_id
  FROM public.sales_agent_sessions
  WHERE session_token = trim(coalesce(p_session_token, '')) AND expires_at > now();

  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Session expired. Please log in again.';
  END IF;

  SELECT * INTO v_agent FROM public.sales_agents WHERE id = v_agent_id;
  IF v_agent.id IS NULL THEN
    RAISE EXCEPTION 'Agent account not found.';
  END IF;

  IF public._hash_agent_password(v_agent.password_salt, p_old_password) <> v_agent.password_hash THEN
    RAISE EXCEPTION 'Current password is incorrect.';
  END IF;

  IF length(trim(coalesce(p_new_password, ''))) < 6 THEN
    RAISE EXCEPTION 'New password must be at least 6 characters long.';
  END IF;

  v_new_salt := gen_random_uuid()::text;
  UPDATE public.sales_agents
  SET
    password_salt = v_new_salt,
    password_hash = public._hash_agent_password(v_new_salt, trim(p_new_password)),
    updated_at = now()
  WHERE id = v_agent_id;

  RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_change_password(text, text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.agent_logout(p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sales_agent_sessions
  WHERE session_token = trim(coalesce(p_session_token, ''));
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_logout(text) TO authenticated, anon;

-- 21. Ensure delete_institution_permanently safely preserves settled agent commission accounting without FK errors
DROP FUNCTION IF EXISTS public.delete_institution_permanently(uuid);
CREATE OR REPLACE FUNCTION public.delete_institution_permanently(
  p_org_id uuid,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
  v_org_name text;
  v_user_ids uuid[];
  v_uid uuid;
  v_deleted_payments int := 0;
  v_deleted_students int := 0;
BEGIN
  v_is_super := public.is_platform_admin() OR (p_master_code = 'Edutechlab@#78692');
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Unauthorized: Only platform super administrators can permanently delete institutions.';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'Institution with ID % not found.', p_org_id;
  END IF;

  SELECT array_agg(id) INTO v_user_ids
  FROM public.profiles
  WHERE organization_id = p_org_id;

  SELECT count(*) INTO v_deleted_payments FROM public.subscription_payments WHERE organization_id = p_org_id;
  SELECT count(*) INTO v_deleted_students FROM public.students WHERE organization_id = p_org_id;

  -- Preserve historical agent commission ledger entries safely by unlinking deleted org
  BEGIN
    UPDATE public.agent_commissions
    SET
      organization_id = NULL,
      source_payment_id = NULL,
      organization_name = v_org_name || ' (Deleted)'
    WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  DELETE FROM public.subscription_payments WHERE organization_id = p_org_id;
  DELETE FROM public.institution_subscriptions WHERE organization_id = p_org_id;
  DELETE FROM public.fee_payments WHERE organization_id = p_org_id;
  DELETE FROM public.student_fee_months WHERE organization_id = p_org_id;
  DELETE FROM public.student_fee_plans WHERE organization_id = p_org_id;
  DELETE FROM public.school_expenses WHERE organization_id = p_org_id;
  DELETE FROM public.exam_marks WHERE organization_id = p_org_id;
  DELETE FROM public.exams WHERE organization_id = p_org_id;
  DELETE FROM public.student_certificates WHERE organization_id = p_org_id;
  DELETE FROM public.class_timetables WHERE organization_id = p_org_id;
  DELETE FROM public.class_homework WHERE organization_id = p_org_id;
  DELETE FROM public.notices WHERE organization_id = p_org_id;
  DELETE FROM public.attendance WHERE organization_id = p_org_id;
  BEGIN
    DELETE FROM public.teacher_attendance WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  DELETE FROM public.staff_permissions WHERE organization_id = p_org_id;
  BEGIN
    DELETE FROM public.role_permissions WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    DELETE FROM public.staff_invites WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  DELETE FROM public.teachers WHERE organization_id = p_org_id;
  DELETE FROM public.students WHERE organization_id = p_org_id;
  BEGIN
    DELETE FROM public.parents WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  DELETE FROM public.sections WHERE organization_id = p_org_id;
  DELETE FROM public.classes WHERE organization_id = p_org_id;
  DELETE FROM public.academic_sessions WHERE organization_id = p_org_id;
  DELETE FROM public.organization_settings WHERE organization_id = p_org_id;
  DELETE FROM public.profiles WHERE organization_id = p_org_id;
  DELETE FROM public.organizations WHERE id = p_org_id;

  IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
    FOREACH v_uid IN ARRAY v_user_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_uid) THEN
        BEGIN
          DELETE FROM auth.users WHERE id = v_uid;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Institution "%s" and all related records (%s payments, %s students, fees, attendance, staff) have been permanently wiped.', v_org_name, v_deleted_payments, v_deleted_students),
    'deleted_organization_id', p_org_id,
    'deleted_payments_count', v_deleted_payments,
    'deleted_students_count', v_deleted_students
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_institution_permanently(uuid, text) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
