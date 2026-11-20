-- =====================================================================
-- MIGRATION 0024: SCHOOL VIRTUAL WALLET & REFERRAL SYSTEM
-- =====================================================================
-- Description:
-- 1. Every School gets a unique Referral Code (e.g., SCH-XXXXXX) & shareable referral links.
-- 2. Every School gets an Institution Virtual Wallet (balance, total_earned, total_spent).
-- 3. Detailed Wallet Transactions Ledger (referral bonuses, subscription discounts, refunds).
-- 4. Unified referral verification & attribution (handles both Sales Agents & Schools).
-- 5. Automatic referral bonus reward when a referred school's subscription is approved.
-- 6. Instant Wallet Credit redemption at subscription payment / renewal checkout.
-- 7. Wallet balance refund protection if payment is rejected.
-- 8. Super Admin controls: Referral bonus configuration, wallet oversight, and manual balance adjustments.
-- =====================================================================

-- 1. ADD REFERRAL COLUMNS TO ORGANIZATIONS
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Unique case-insensitive index on school referral code
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_referral_code_upper 
  ON public.organizations (upper(trim(referral_code))) 
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_referred_by_org_id 
  ON public.organizations (referred_by_org_id);

-- 2. FUNCTION TO GENERATE UNIQUE SCHOOL REFERRAL CODE
CREATE OR REPLACE FUNCTION public.generate_school_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code text;
  v_exists boolean;
  v_loop integer := 0;
BEGIN
  LOOP
    v_loop := v_loop + 1;
    v_code := 'SCH-';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;

    -- Ensure neither organization nor sales agent shares this code
    SELECT EXISTS (
      SELECT 1 FROM public.organizations WHERE upper(trim(referral_code)) = v_code
      UNION ALL
      SELECT 1 FROM public.sales_agents WHERE upper(trim(agent_code)) = v_code
    ) INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_code;
    END IF;

    IF v_loop > 50 THEN
      -- Fallback to UUID segment
      RETURN 'SCH-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    END IF;
  END LOOP;
END;
$$;

-- Backfill referral code for any existing organization that has null
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.organizations WHERE referral_code IS NULL OR trim(referral_code) = '' LOOP
    UPDATE public.organizations
    SET referral_code = public.generate_school_referral_code()
    WHERE id = r.id;
  END LOOP;
END $$;

-- 3. TRIGGER TO AUTO-ASSIGN REFERRAL CODE TO NEW ORGANIZATIONS
CREATE OR REPLACE FUNCTION public.trg_fn_assign_school_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR trim(NEW.referral_code) = '' THEN
    NEW.referral_code := public.generate_school_referral_code();
  ELSE
    NEW.referral_code := upper(trim(NEW.referral_code));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_school_referral_code ON public.organizations;
CREATE TRIGGER trg_assign_school_referral_code
  BEFORE INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_assign_school_referral_code();

-- 4. INSTITUTION VIRTUAL WALLET TABLE
CREATE TABLE IF NOT EXISTS public.institution_wallets (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  total_earned numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_earned >= 0),
  total_spent numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_spent >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. INSTITUTION WALLET TRANSACTIONS LEDGER
CREATE TABLE IF NOT EXISTS public.institution_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL, -- positive for credit, negative for debit
  transaction_type text NOT NULL CHECK (transaction_type IN ('referral_bonus', 'subscription_discount', 'manual_adjustment', 'refund')),
  source_payment_id uuid REFERENCES public.subscription_payments(id) ON DELETE SET NULL,
  referred_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  referred_org_name text,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institution_wallet_transactions_org 
  ON public.institution_wallet_transactions (organization_id, created_at DESC);

-- Backfill wallets for existing organizations
INSERT INTO public.institution_wallets (organization_id, balance, total_earned, total_spent)
SELECT id, 0.00, 0.00, 0.00
FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;

-- Trigger to auto-create wallet on new organization creation
CREATE OR REPLACE FUNCTION public.trg_fn_create_school_wallet()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.institution_wallets (organization_id, balance, total_earned, total_spent)
  VALUES (NEW.id, 0.00, 0.00, 0.00)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_school_wallet ON public.organizations;
CREATE TRIGGER trg_create_school_wallet
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_create_school_wallet();

-- 6. ADD WALLET DISCOUNT COLUMN TO SUBSCRIPTION PAYMENTS
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS wallet_discount numeric DEFAULT 0;

-- 7. ADD REFERRAL BONUS SETTINGS TO PLATFORM SETTINGS
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS school_referral_bonus_amount numeric NOT NULL DEFAULT 500.00;

-- 8. ENABLE RLS ON WALLET TABLES
ALTER TABLE public.institution_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_wallet_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Wallets read policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members read own wallet' AND tablename = 'institution_wallets') THEN
    CREATE POLICY "org members read own wallet" ON public.institution_wallets
      FOR SELECT TO authenticated
      USING (organization_id = public.user_org_id() OR public.is_platform_admin());
  END IF;

  -- Wallets super admin full control
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super admins manage wallets' AND tablename = 'institution_wallets') THEN
    CREATE POLICY "super admins manage wallets" ON public.institution_wallets
      FOR ALL TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;

  -- Transactions read policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members read own wallet transactions' AND tablename = 'institution_wallet_transactions') THEN
    CREATE POLICY "org members read own wallet transactions" ON public.institution_wallet_transactions
      FOR SELECT TO authenticated
      USING (organization_id = public.user_org_id() OR public.is_platform_admin());
  END IF;

  -- Transactions super admin full control
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super admins manage wallet transactions' AND tablename = 'institution_wallet_transactions') THEN
    CREATE POLICY "super admins manage wallet transactions" ON public.institution_wallet_transactions
      FOR ALL TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;
END $$;

-- 9. UNIFIED REFERRAL CODE VALIDATION (Supports Sales Agents & Schools)
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
  v_agent record;
  v_org record;
BEGIN
  v_clean := upper(trim(coalesce(p_code, '')));
  IF v_clean = '' THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  -- 1. Check Sales Agents first
  SELECT id, agent_code, full_name, is_active
  INTO v_agent
  FROM public.sales_agents
  WHERE upper(trim(agent_code)) = v_clean;

  IF v_agent.id IS NOT NULL THEN
    IF NOT v_agent.is_active THEN
      RETURN jsonb_build_object('valid', false, 'error', 'This partner referral code is currently inactive.');
    END IF;
    RETURN jsonb_build_object(
      'valid', true,
      'type', 'agent',
      'agent_code', v_agent.agent_code,
      'agent_name', v_agent.full_name
    );
  END IF;

  -- 2. Check Schools / Organizations
  SELECT id, name, referral_code, is_active, is_paused
  INTO v_org
  FROM public.organizations
  WHERE upper(trim(referral_code)) = v_clean;

  IF v_org.id IS NOT NULL THEN
    IF coalesce(v_org.is_paused, false) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'This school referral code is currently inactive.');
    END IF;
    RETURN jsonb_build_object(
      'valid', true,
      'type', 'school',
      'agent_code', v_org.referral_code,
      'agent_name', v_org.name,
      'school_name', v_org.name
    );
  END IF;

  RETURN jsonb_build_object('valid', false, 'error', 'Referral code "' || v_clean || '" not found or inactive.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO authenticated, anon;

-- 10. UNIFIED ATTACH REFERRAL CODE TO NEW INSTITUTE
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
  v_ref_org record;
  v_target_org_id uuid;
BEGIN
  v_clean_code := upper(trim(coalesce(p_referral_code, '')));
  v_clean_login := upper(trim(coalesce(p_login_id, '')));

  IF v_clean_code = '' OR v_clean_login = '' THEN
    RETURN jsonb_build_object('attached', false);
  END IF;

  SELECT organization_id INTO v_target_org_id
  FROM public.profiles
  WHERE upper(trim(login_id)) = v_clean_login
  LIMIT 1;

  IF v_target_org_id IS NULL THEN
    RETURN jsonb_build_object('attached', false, 'error', 'Institution profile not found.');
  END IF;

  -- Check Sales Agents
  SELECT id, agent_code, full_name, is_active
  INTO v_agent
  FROM public.sales_agents
  WHERE upper(trim(agent_code)) = v_clean_code;

  IF v_agent.id IS NOT NULL THEN
    IF NOT v_agent.is_active THEN
      RETURN jsonb_build_object('attached', false, 'error', 'Partner referral code is inactive.');
    END IF;

    UPDATE public.organizations
    SET
      referred_by_agent_id = v_agent.id,
      referred_at = coalesce(referred_at, now()),
      referral_code_used = v_agent.agent_code
    WHERE id = v_target_org_id
      AND referred_by_agent_id IS NULL
      AND referred_by_org_id IS NULL;

    RETURN jsonb_build_object(
      'attached', true,
      'type', 'agent',
      'organization_id', v_target_org_id,
      'agent_code', v_agent.agent_code,
      'agent_name', v_agent.full_name
    );
  END IF;

  -- Check Schools
  SELECT id, name, referral_code
  INTO v_ref_org
  FROM public.organizations
  WHERE upper(trim(referral_code)) = v_clean_code;

  IF v_ref_org.id IS NOT NULL THEN
    -- Disallow self-referral
    IF v_ref_org.id = v_target_org_id THEN
      RETURN jsonb_build_object('attached', false, 'error', 'A school cannot refer itself.');
    END IF;

    UPDATE public.organizations
    SET
      referred_by_org_id = v_ref_org.id,
      referred_at = coalesce(referred_at, now()),
      referral_code_used = v_ref_org.referral_code
    WHERE id = v_target_org_id
      AND referred_by_agent_id IS NULL
      AND referred_by_org_id IS NULL;

    RETURN jsonb_build_object(
      'attached', true,
      'type', 'school',
      'organization_id', v_target_org_id,
      'referrer_school_id', v_ref_org.id,
      'school_name', v_ref_org.name
    );
  END IF;

  RETURN jsonb_build_object('attached', false, 'error', 'Referral code not found.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_referral_to_institute(text, text) TO authenticated, anon;

-- 11. INTERNAL HELPER: CREDIT SCHOOL REFERRAL BONUS ON SUBSCRIPTION APPROVAL
CREATE OR REPLACE FUNCTION public._credit_school_referral_bonus(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay record;
  v_org record;
  v_ref_org record;
  v_bonus_amount numeric := 500.00;
  v_settings record;
  v_already_rewarded boolean;
BEGIN
  SELECT * INTO v_pay FROM public.subscription_payments WHERE id = p_payment_id;
  IF v_pay.id IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Payment not found');
  END IF;

  SELECT id, name, referred_by_org_id INTO v_org
  FROM public.organizations
  WHERE id = v_pay.organization_id;

  IF v_org.id IS NULL OR v_org.referred_by_org_id IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'No referring school linked to this institute.');
  END IF;

  -- Ensure referrer school exists
  SELECT id, name INTO v_ref_org FROM public.organizations WHERE id = v_org.referred_by_org_id;
  IF v_ref_org.id IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Referring school record not found.');
  END IF;

  -- Check if bonus was already rewarded for referring this school
  SELECT EXISTS (
    SELECT 1 FROM public.institution_wallet_transactions
    WHERE organization_id = v_org.referred_by_org_id
      AND referred_org_id = v_org.id
      AND transaction_type = 'referral_bonus'
  ) INTO v_already_rewarded;

  IF v_already_rewarded THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Referral bonus already awarded for this school.');
  END IF;

  -- Fetch reward amount from platform_settings
  SELECT coalesce(school_referral_bonus_amount, 500.00) INTO v_bonus_amount
  FROM public.platform_settings
  WHERE id = 'global';

  IF v_bonus_amount IS NULL OR v_bonus_amount <= 0 THEN
    v_bonus_amount := 500.00;
  END IF;

  -- Credit Referrer's Virtual Wallet
  INSERT INTO public.institution_wallets (organization_id, balance, total_earned, total_spent, updated_at)
  VALUES (v_ref_org.id, v_bonus_amount, v_bonus_amount, 0.00, now())
  ON CONFLICT (organization_id) DO UPDATE
  SET balance = public.institution_wallets.balance + v_bonus_amount,
      total_earned = public.institution_wallets.total_earned + v_bonus_amount,
      updated_at = now();

  -- Record in Ledger
  INSERT INTO public.institution_wallet_transactions (
    organization_id, amount, transaction_type, source_payment_id,
    referred_org_id, referred_org_name, description
  ) VALUES (
    v_ref_org.id, v_bonus_amount, 'referral_bonus', p_payment_id,
    v_org.id, v_org.name, 'Referral reward: ' || v_org.name || ' activated their subscription!'
  );

  RETURN jsonb_build_object(
    'credited', true,
    'bonus_amount', v_bonus_amount,
    'referrer_id', v_ref_org.id,
    'referrer_name', v_ref_org.name,
    'referred_school', v_org.name
  );
END;
$$;

-- 12. ENHANCED SUBMIT SUBSCRIPTION PAYMENT WITH WALLET BALANCE REDEMPTION
DROP FUNCTION IF EXISTS public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text, text, numeric, numeric);
DROP FUNCTION IF EXISTS public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text, text, numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION public.submit_subscription_payment(
  p_org_id uuid,
  p_student_limit integer,
  p_amount numeric,
  p_utr_number text,
  p_screenshot_url text DEFAULT null,
  p_payment_category text DEFAULT 'recurring',
  p_joining_fee_portion numeric DEFAULT 0,
  p_notes text DEFAULT null,
  p_coupon_code text DEFAULT null,
  p_discount_amount numeric DEFAULT 0,
  p_original_amount numeric DEFAULT null,
  p_wallet_deduction numeric DEFAULT 0
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
  v_coupon record;
  v_code text;
  v_orig numeric;
  v_disc numeric;
  v_wallet_deduct numeric := 0;
  v_wallet record;
  v_final_payable numeric;
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

  v_wallet_deduct := greatest(0, round(coalesce(p_wallet_deduction, 0), 2));
  v_disc := greatest(0, round(coalesce(p_discount_amount, 0), 2));
  v_final_payable := greatest(0, round(coalesce(p_amount, 0), 2));
  v_orig := coalesce(p_original_amount, v_final_payable + v_disc + v_wallet_deduct);

  -- Ensure total transaction value is positive
  IF (v_final_payable + v_wallet_deduct) <= 0 THEN
    RAISE EXCEPTION 'Payment amount cannot be zero without valid wallet deduction.';
  END IF;

  -- Validate and deduct wallet balance if requested
  IF v_wallet_deduct > 0 THEN
    SELECT * INTO v_wallet FROM public.institution_wallets WHERE organization_id = p_org_id FOR UPDATE;
    IF v_wallet.organization_id IS NULL OR v_wallet.balance < v_wallet_deduct THEN
      RAISE EXCEPTION 'Insufficient wallet balance. Available: ₹%, Requested: ₹%', 
        coalesce(v_wallet.balance, 0), v_wallet_deduct;
    END IF;

    UPDATE public.institution_wallets
    SET balance = balance - v_wallet_deduct,
        total_spent = total_spent + v_wallet_deduct,
        updated_at = now()
    WHERE organization_id = p_org_id;
  END IF;

  v_cat := lower(trim(coalesce(p_payment_category, 'recurring')));
  IF v_cat NOT IN ('joining_fee', 'recurring', 'combined') THEN
    v_cat := 'recurring';
  END IF;

  v_joining := greatest(0, least(v_final_payable, coalesce(p_joining_fee_portion, 0)));
  IF v_cat = 'joining_fee' THEN
    v_joining := v_final_payable;
  ELSIF v_cat = 'recurring' THEN
    v_joining := 0;
  END IF;

  v_code := upper(trim(coalesce(p_coupon_code, '')));

  INSERT INTO public.subscription_payments (
    organization_id, requested_by, student_limit, amount, utr_number, screenshot_url,
    status, payment_category, joining_fee_portion, notes,
    coupon_code, original_amount, discount_amount, wallet_discount
  ) VALUES (
    p_org_id, auth.uid(), p_student_limit, v_final_payable, v_clean_utr, p_screenshot_url,
    'pending', v_cat, v_joining, nullif(trim(coalesce(p_notes, '')), ''),
    nullif(v_code, ''), v_orig, v_disc, v_wallet_deduct
  ) RETURNING id INTO v_payment_id;

  -- Log wallet deduction in transactions ledger
  IF v_wallet_deduct > 0 THEN
    INSERT INTO public.institution_wallet_transactions (
      organization_id, amount, transaction_type, source_payment_id, description
    ) VALUES (
      p_org_id, -v_wallet_deduct, 'subscription_discount', v_payment_id,
      'Redeemed ₹' || v_wallet_deduct || ' wallet credits towards subscription renewal (UTR: ' || v_clean_utr || ')'
    );
  END IF;

  -- Record coupon redemption if coupon was applied
  IF v_code <> '' THEN
    SELECT * INTO v_coupon FROM public.platform_coupons WHERE upper(trim(code)) = v_code LIMIT 1;
    IF v_coupon.id IS NOT NULL THEN
      UPDATE public.platform_coupons
      SET times_used = times_used + 1, updated_at = now()
      WHERE id = v_coupon.id;

      INSERT INTO public.coupon_redemptions (
        coupon_id, coupon_code, organization_id, payment_id,
        original_amount, discount_amount, final_amount, redeemed_by
      ) VALUES (
        v_coupon.id, v_coupon.code, p_org_id, v_payment_id,
        v_orig, v_disc, v_final_payable, auth.uid()
      );
    END IF;
  END IF;

  UPDATE public.institution_subscriptions
  SET
    status = 'pending_approval',
    updated_at = now()
  WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'payment_category', v_cat,
    'wallet_discount', v_wallet_deduct,
    'coupon_applied', nullif(v_code, ''),
    'discount_amount', v_disc,
    'net_amount_paid', v_final_payable,
    'message', 'Payment proof submitted. Your subscription will be approved shortly.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text, text, numeric, numeric, numeric) TO authenticated;

-- 13. ENHANCED APPROVE SUBSCRIPTION PAYMENT (Auto-credits Sales Agent & School Referrer)
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
  v_agent_comm_result jsonb;
  v_school_referral_result jsonb;
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

  -- 1. Auto credit linked sales agent commission
  v_agent_comm_result := public._credit_agent_commission_for_payment(p_payment_id);

  -- 2. Auto credit referring school referral bonus in virtual wallet!
  v_school_referral_result := public._credit_school_referral_bonus(p_payment_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Payment approved successfully.',
    'new_period_ends_at', v_new_end,
    'student_limit', v_pay.student_limit,
    'agent_commission', v_agent_comm_result,
    'school_referral', v_school_referral_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_subscription_payment(uuid, integer, text, text, numeric) TO authenticated, anon;

-- 14. ENHANCED REJECT SUBSCRIPTION PAYMENT (With Wallet Balance Refund Protection)
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

  -- Refund wallet discount back to school wallet if any was used
  IF coalesce(v_pay.wallet_discount, 0) > 0 THEN
    UPDATE public.institution_wallets
    SET balance = balance + v_pay.wallet_discount,
        total_spent = greatest(0, total_spent - v_pay.wallet_discount),
        updated_at = now()
    WHERE organization_id = v_pay.organization_id;

    INSERT INTO public.institution_wallet_transactions (
      organization_id, amount, transaction_type, source_payment_id, description
    ) VALUES (
      v_pay.organization_id, v_pay.wallet_discount, 'refund', p_payment_id,
      'Refund of ₹' || v_pay.wallet_discount || ' wallet credits due to rejected payment (' || coalesce(nullif(trim(p_reason), ''), 'rejected') || ')'
    );
  END IF;

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
    'message', 'Subscription payment request rejected and wallet balance refunded if used.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_subscription_payment(uuid, text, text) TO authenticated, anon;

-- 15. RPC: GET SCHOOL REFERRAL & WALLET OVERVIEW (For School Dashboard & Subscription Page)
CREATE OR REPLACE FUNCTION public.get_school_referral_and_wallet_data(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
  v_wallet record;
  v_bonus_rate numeric := 500.00;
  v_referred_schools jsonb;
  v_transactions jsonb;
BEGIN
  IF p_org_id != public.user_org_id() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  SELECT id, name, referral_code, created_at INTO v_org
  FROM public.organizations
  WHERE id = p_org_id;

  IF v_org.id IS NULL THEN
    RAISE EXCEPTION 'Organization not found.';
  END IF;

  -- Ensure wallet row exists
  INSERT INTO public.institution_wallets (organization_id, balance, total_earned, total_spent)
  VALUES (p_org_id, 0.00, 0.00, 0.00)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.institution_wallets WHERE organization_id = p_org_id;

  -- Referral bonus amount setting
  SELECT coalesce(school_referral_bonus_amount, 500.00) INTO v_bonus_rate
  FROM public.platform_settings
  WHERE id = 'global';

  -- List of referred schools
  SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_referred_schools
  FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'created_at', o.created_at,
      'status', coalesce(s.status, 'trial'),
      'is_trial', coalesce(s.is_trial, true),
      'bonus_earned', coalesce(t.bonus_amount, 0),
      'is_rewarded', (t.bonus_amount IS NOT NULL AND t.bonus_amount > 0)
    ) AS row_data,
    o.created_at
    FROM public.organizations o
    LEFT JOIN public.institution_subscriptions s ON s.organization_id = o.id
    LEFT JOIN (
      SELECT referred_org_id, sum(amount) AS bonus_amount
      FROM public.institution_wallet_transactions
      WHERE organization_id = p_org_id AND transaction_type = 'referral_bonus'
      GROUP BY referred_org_id
    ) t ON t.referred_org_id = o.id
    WHERE o.referred_by_org_id = p_org_id
  ) s;

  -- Recent wallet transactions ledger
  SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_transactions
  FROM (
    SELECT jsonb_build_object(
      'id', id,
      'amount', amount,
      'transaction_type', transaction_type,
      'referred_org_name', referred_org_name,
      'description', description,
      'created_at', created_at
    ) AS row_data,
    created_at
    FROM public.institution_wallet_transactions
    WHERE organization_id = p_org_id
    LIMIT 50
  ) tx;

  RETURN jsonb_build_object(
    'organization_id', v_org.id,
    'school_name', v_org.name,
    'referral_code', v_org.referral_code,
    'bonus_rate_per_school', v_bonus_rate,
    'wallet', jsonb_build_object(
      'balance', coalesce(v_wallet.balance, 0),
      'total_earned', coalesce(v_wallet.total_earned, 0),
      'total_spent', coalesce(v_wallet.total_spent, 0),
      'updated_at', v_wallet.updated_at
    ),
    'referred_schools_count', coalesce(jsonb_array_length(v_referred_schools), 0),
    'referred_schools', v_referred_schools,
    'transactions', v_transactions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_referral_and_wallet_data(uuid) TO authenticated;

-- 16. SUPER ADMIN RPC: LIST ALL SCHOOL WALLETS & REFERRALS
CREATE OR REPLACE FUNCTION public.admin_list_school_wallets(p_master_code text DEFAULT null)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallets jsonb;
  v_total_balance numeric;
  v_total_earned numeric;
  v_total_spent numeric;
  v_bonus_rate numeric;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  SELECT coalesce(school_referral_bonus_amount, 500.00) INTO v_bonus_rate
  FROM public.platform_settings
  WHERE id = 'global';

  SELECT
    coalesce(sum(balance), 0),
    coalesce(sum(total_earned), 0),
    coalesce(sum(total_spent), 0)
  INTO v_total_balance, v_total_earned, v_total_spent
  FROM public.institution_wallets;

  SELECT coalesce(jsonb_agg(row_data ORDER BY total_earned DESC, name ASC), '[]'::jsonb)
  INTO v_wallets
  FROM (
    SELECT jsonb_build_object(
      'organization_id', o.id,
      'name', o.name,
      'referral_code', o.referral_code,
      'created_at', o.created_at,
      'is_active', o.is_active,
      'balance', coalesce(w.balance, 0),
      'total_earned', coalesce(w.total_earned, 0),
      'total_spent', coalesce(w.total_spent, 0),
      'referred_count', coalesce(ref_counts.cnt, 0),
      'referred_by_code', o.referral_code_used
    ) AS row_data,
    coalesce(w.total_earned, 0) AS total_earned,
    o.name
    FROM public.organizations o
    LEFT JOIN public.institution_wallets w ON w.organization_id = o.id
    LEFT JOIN (
      SELECT referred_by_org_id, count(*) AS cnt
      FROM public.organizations
      WHERE referred_by_org_id IS NOT NULL
      GROUP BY referred_by_org_id
    ) ref_counts ON ref_counts.referred_by_org_id = o.id
  ) s;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_rate_per_school', v_bonus_rate,
    'stats', jsonb_build_object(
      'total_balance', v_total_balance,
      'total_earned', v_total_earned,
      'total_spent', v_total_spent,
      'total_schools', coalesce(jsonb_array_length(v_wallets), 0)
    ),
    'wallets', v_wallets
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_school_wallets(text) TO authenticated, anon;

-- 17. SUPER ADMIN RPC: MANUAL CREDIT / DEBIT ADJUSTMENT TO SCHOOL WALLET
CREATE OR REPLACE FUNCTION public.admin_adjust_school_wallet(
  p_org_id uuid,
  p_amount numeric,
  p_type text, -- 'credit' or 'debit'
  p_notes text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_amt numeric;
  v_wallet record;
  v_org_name text;
  v_tx_type text;
  v_delta numeric;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'School organization not found.';
  END IF;

  v_clean_amt := round(abs(coalesce(p_amount, 0)), 2);
  IF v_clean_amt <= 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be greater than zero.';
  END IF;

  -- Ensure wallet exists
  INSERT INTO public.institution_wallets (organization_id, balance, total_earned, total_spent)
  VALUES (p_org_id, 0.00, 0.00, 0.00)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.institution_wallets WHERE organization_id = p_org_id FOR UPDATE;

  IF lower(trim(p_type)) = 'credit' THEN
    v_delta := v_clean_amt;
    v_tx_type := 'manual_adjustment';

    UPDATE public.institution_wallets
    SET balance = balance + v_clean_amt,
        total_earned = total_earned + v_clean_amt,
        updated_at = now()
    WHERE organization_id = p_org_id;

    INSERT INTO public.institution_wallet_transactions (
      organization_id, amount, transaction_type, description, created_by
    ) VALUES (
      p_org_id, v_clean_amt, 'manual_adjustment',
      coalesce(nullif(trim(p_notes), ''), 'Manual bonus credit added by Super Admin'),
      auth.uid()
    );

  ELSIF lower(trim(p_type)) = 'debit' THEN
    IF v_wallet.balance < v_clean_amt THEN
      RAISE EXCEPTION 'Cannot debit ₹%. Available balance is only ₹%.', v_clean_amt, v_wallet.balance;
    END IF;

    v_delta := -v_clean_amt;
    v_tx_type := 'manual_adjustment';

    UPDATE public.institution_wallets
    SET balance = balance - v_clean_amt,
        total_spent = total_spent + v_clean_amt,
        updated_at = now()
    WHERE organization_id = p_org_id;

    INSERT INTO public.institution_wallet_transactions (
      organization_id, amount, transaction_type, description, created_by
    ) VALUES (
      p_org_id, -v_clean_amt, 'manual_adjustment',
      coalesce(nullif(trim(p_notes), ''), 'Manual debit adjustment by Super Admin'),
      auth.uid()
    );
  ELSE
    RAISE EXCEPTION 'Invalid adjustment type. Must be "credit" or "debit".';
  END IF;

  SELECT * INTO v_wallet FROM public.institution_wallets WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'school_name', v_org_name,
    'adjusted_amount', v_delta,
    'new_balance', v_wallet.balance,
    'message', 'Wallet for "' || v_org_name || '" updated successfully. New balance: ₹' || v_wallet.balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_school_wallet(uuid, numeric, text, text, text) TO authenticated, anon;

-- 18. SUPER ADMIN RPC: UPDATE REFERRAL BONUS AMOUNT SETTING
CREATE OR REPLACE FUNCTION public.admin_update_school_referral_reward(
  p_bonus_amount numeric,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amt numeric;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  v_amt := round(greatest(0, coalesce(p_bonus_amount, 0)), 2);

  UPDATE public.platform_settings
  SET school_referral_bonus_amount = v_amt,
      updated_at = now()
  WHERE id = 'global';

  RETURN jsonb_build_object(
    'success', true,
    'bonus_amount', v_amt,
    'message', 'School referral reward set to ₹' || v_amt || ' per successful school onboarding.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_school_referral_reward(numeric, text) TO authenticated, anon;

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
