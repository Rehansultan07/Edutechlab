-- =====================================================================
-- MIGRATION 0022: COUPON CODES, DISCOUNT ENGINE & TRIAL MANAGEMENT
-- =====================================================================
-- Description:
-- 1. Super Admin Coupon Code Generation & Management (Validity, discount type, max uses, limits)
-- 2. Client-side Coupon Validation & Redemption at Subscription / Billing
-- 3. Dedicated RPCs to End / Revoke Free Trials immediately
-- =====================================================================

-- 1. PLATFORM COUPONS TABLE
CREATE TABLE IF NOT EXISTS public.platform_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed_amount')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_discount_amount numeric DEFAULT NULL,
  min_order_amount numeric DEFAULT 0,
  applicable_to text NOT NULL DEFAULT 'all' CHECK (applicable_to IN ('all', 'recurring', 'joining_fee', 'combined')),
  max_uses integer DEFAULT NULL,
  times_used integer NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure uppercase unique index on coupon code
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_coupons_code_upper ON public.platform_coupons (upper(trim(code)));

-- 2. COUPON REDEMPTIONS TABLE (Audit trail of who used what coupon)
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid REFERENCES public.platform_coupons(id) ON DELETE SET NULL,
  coupon_code text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_id uuid,
  original_amount numeric NOT NULL,
  discount_amount numeric NOT NULL,
  final_amount numeric NOT NULL,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. ADD COUPON COLUMNS TO SUBSCRIPTION PAYMENTS
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

-- 4. ENABLE RLS
ALTER TABLE public.platform_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anyone can read active coupons' AND tablename = 'platform_coupons') THEN
    CREATE POLICY "anyone can read active coupons" ON public.platform_coupons
      FOR SELECT USING (is_active = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super admins manage platform_coupons' AND tablename = 'platform_coupons') THEN
    CREATE POLICY "super admins manage platform_coupons" ON public.platform_coupons
      FOR ALL TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members view redemptions' AND tablename = 'coupon_redemptions') THEN
    CREATE POLICY "org members view redemptions" ON public.coupon_redemptions
      FOR SELECT TO authenticated
      USING (organization_id = public.user_org_id() OR public.is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super admins manage coupon_redemptions' AND tablename = 'coupon_redemptions') THEN
    CREATE POLICY "super admins manage coupon_redemptions" ON public.coupon_redemptions
      FOR ALL TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;
END $$;

-- 5. RPC: VALIDATE & APPLY COUPON CODE (Called by schools at checkout)
CREATE OR REPLACE FUNCTION public.validate_and_apply_coupon(
  p_code text,
  p_amount numeric,
  p_category text DEFAULT 'recurring',
  p_org_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_coupon record;
  v_discount numeric := 0;
  v_final numeric := 0;
  v_cat text;
BEGIN
  v_code := upper(trim(coalesce(p_code, '')));
  IF v_code = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Please enter a coupon code.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid order amount.');
  END IF;

  v_cat := lower(trim(coalesce(p_category, 'recurring')));

  SELECT * INTO v_coupon
  FROM public.platform_coupons
  WHERE upper(trim(code)) = v_code
  LIMIT 1;

  IF v_coupon.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Coupon code "' || v_code || '" is invalid.');
  END IF;

  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This coupon is no longer active.');
  END IF;

  IF v_coupon.valid_from > now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This coupon is not active yet.');
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < now() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'This coupon expired on ' || to_char(v_coupon.valid_until, 'DD Mon YYYY') || '.'
    );
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.times_used >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This coupon has reached its maximum usage limit.');
  END IF;

  IF v_coupon.applicable_to != 'all' AND v_coupon.applicable_to != v_cat THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'This coupon is only applicable to ' || v_coupon.applicable_to || ' payments.'
    );
  END IF;

  IF v_coupon.min_order_amount IS NOT NULL AND v_coupon.min_order_amount > 0 AND p_amount < v_coupon.min_order_amount THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Minimum order amount of ₹' || v_coupon.min_order_amount || ' is required to use this coupon.'
    );
  END IF;

  -- Calculate discount
  IF v_coupon.discount_type = 'percent' THEN
    v_discount := round((p_amount * v_coupon.discount_value) / 100.0, 2);
    IF v_coupon.max_discount_amount IS NOT NULL AND v_coupon.max_discount_amount > 0 THEN
      v_discount := least(v_discount, v_coupon.max_discount_amount);
    END IF;
  ELSE
    v_discount := least(p_amount, v_coupon.discount_value);
  END IF;

  v_discount := greatest(0, least(v_discount, p_amount));
  v_final := greatest(0, round(p_amount - v_discount, 2));

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount,
    'original_amount', p_amount,
    'final_amount', v_final,
    'valid_until', v_coupon.valid_until,
    'description', v_coupon.description,
    'message', 'Coupon ' || v_coupon.code || ' applied successfully! You saved ₹' || v_discount || '.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_and_apply_coupon(text, numeric, text, uuid) TO authenticated, anon;

-- 6. RPC: SUPER ADMIN CREATE COUPON
CREATE OR REPLACE FUNCTION public.admin_create_coupon(
  p_code text,
  p_discount_type text,
  p_discount_value numeric,
  p_valid_until timestamptz DEFAULT null,
  p_max_uses integer DEFAULT null,
  p_applicable_to text DEFAULT 'all',
  p_description text DEFAULT null,
  p_min_order_amount numeric DEFAULT 0,
  p_max_discount_amount numeric DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_coupon_id uuid;
  v_type text;
  v_cat text;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  v_code := upper(trim(coalesce(p_code, '')));
  IF v_code = '' THEN
    RAISE EXCEPTION 'Coupon code cannot be empty.';
  END IF;

  IF length(v_code) < 3 OR length(v_code) > 25 THEN
    RAISE EXCEPTION 'Coupon code must be between 3 and 25 characters.';
  END IF;

  IF p_discount_value IS NULL OR p_discount_value <= 0 THEN
    RAISE EXCEPTION 'Discount value must be greater than zero.';
  END IF;

  v_type := lower(trim(coalesce(p_discount_type, 'percent')));
  IF v_type NOT IN ('percent', 'fixed_amount') THEN
    v_type := 'percent';
  END IF;

  IF v_type = 'percent' AND p_discount_value > 100 THEN
    RAISE EXCEPTION 'Percentage discount cannot exceed 100%%.';
  END IF;

  v_cat := lower(trim(coalesce(p_applicable_to, 'all')));
  IF v_cat NOT IN ('all', 'recurring', 'joining_fee', 'combined') THEN
    v_cat := 'all';
  END IF;

  IF EXISTS (SELECT 1 FROM public.platform_coupons WHERE upper(trim(code)) = v_code) THEN
    RAISE EXCEPTION 'Coupon code "%" already exists.', v_code;
  END IF;

  INSERT INTO public.platform_coupons (
    code, description, discount_type, discount_value, max_discount_amount,
    min_order_amount, applicable_to, max_uses, valid_until, is_active, created_by
  ) VALUES (
    v_code, nullif(trim(coalesce(p_description, '')), ''),
    v_type, round(p_discount_value, 2),
    case when p_max_discount_amount > 0 then round(p_max_discount_amount, 2) else null end,
    greatest(0, coalesce(p_min_order_amount, 0)),
    v_cat,
    case when p_max_uses > 0 then p_max_uses else null end,
    p_valid_until,
    true,
    auth.uid()
  ) RETURNING id INTO v_coupon_id;

  RETURN jsonb_build_object(
    'success', true,
    'coupon_id', v_coupon_id,
    'code', v_code,
    'message', 'Coupon "' || v_code || '" created successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_coupon(text, text, numeric, timestamptz, integer, text, text, numeric, numeric, text) TO authenticated, anon;

-- 7. RPC: SUPER ADMIN UPDATE COUPON
CREATE OR REPLACE FUNCTION public.admin_update_coupon(
  p_coupon_id uuid,
  p_is_active boolean DEFAULT null,
  p_valid_until timestamptz DEFAULT null,
  p_max_uses integer DEFAULT null,
  p_description text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  UPDATE public.platform_coupons
  SET
    is_active = coalesce(p_is_active, is_active),
    valid_until = p_valid_until,
    max_uses = case when p_max_uses > 0 then p_max_uses when p_max_uses = 0 then null else max_uses end,
    description = coalesce(nullif(trim(p_description), ''), description),
    updated_at = now()
  WHERE id = p_coupon_id;

  RETURN jsonb_build_object('success', true, 'message', 'Coupon updated successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_coupon(uuid, boolean, timestamptz, integer, text, text) TO authenticated, anon;

-- 8. RPC: SUPER ADMIN DELETE COUPON
CREATE OR REPLACE FUNCTION public.admin_delete_coupon(
  p_coupon_id uuid,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  SELECT code INTO v_code FROM public.platform_coupons WHERE id = p_coupon_id;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Coupon not found.';
  END IF;

  DELETE FROM public.platform_coupons WHERE id = p_coupon_id;

  RETURN jsonb_build_object('success', true, 'message', 'Coupon "' || v_code || '" deleted.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_coupon(uuid, text) TO authenticated, anon;

-- 9. RPC: SUPER ADMIN LIST ALL COUPONS WITH STATS
CREATE OR REPLACE FUNCTION public.admin_list_coupons(p_master_code text DEFAULT null)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list jsonb;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_list
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'code', c.code,
      'description', c.description,
      'discount_type', c.discount_type,
      'discount_value', c.discount_value,
      'max_discount_amount', c.max_discount_amount,
      'min_order_amount', c.min_order_amount,
      'applicable_to', c.applicable_to,
      'max_uses', c.max_uses,
      'times_used', c.times_used,
      'valid_from', c.valid_from,
      'valid_until', c.valid_until,
      'is_active', c.is_active,
      'created_at', c.created_at,
      'is_expired', (c.valid_until IS NOT NULL AND c.valid_until < now()),
      'total_discount_given', coalesce(r.total_discount, 0),
      'redemptions_count', coalesce(r.redemptions_count, 0)
    ) AS row_data,
    c.created_at
    FROM public.platform_coupons c
    LEFT JOIN (
      SELECT
        coupon_id,
        coalesce(sum(discount_amount), 0) AS total_discount,
        count(*) AS redemptions_count
      FROM public.coupon_redemptions
      GROUP BY coupon_id
    ) r ON r.coupon_id = c.id
  ) s;

  RETURN jsonb_build_object(
    'success', true,
    'coupons', v_list
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_coupons(text) TO authenticated, anon;

-- 10. RPC: SUPER ADMIN END INSTITUTION TRIAL (Dedicated, explicit trial termination)
CREATE OR REPLACE FUNCTION public.admin_end_institution_trial(
  p_org_id uuid,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name text;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'Institution not found.';
  END IF;

  UPDATE public.institution_subscriptions
  SET
    is_trial = false,
    status = 'expired',
    current_period_ends_at = now() - interval '1 second',
    trial_ends_at = now() - interval '1 second',
    updated_at = now()
  WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Free trial for "' || v_org_name || '" has been ended. The school must now purchase a subscription.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_end_institution_trial(uuid, text) TO authenticated, anon;

-- 11. ENHANCED SUBMIT SUBSCRIPTION PAYMENT (Supports coupon tracking)
DROP FUNCTION IF EXISTS public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text, text, numeric, numeric);

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
  p_original_amount numeric DEFAULT null
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

  v_code := upper(trim(coalesce(p_coupon_code, '')));
  v_disc := greatest(0, coalesce(p_discount_amount, 0));
  v_orig := coalesce(p_original_amount, p_amount + v_disc);

  INSERT INTO public.subscription_payments (
    organization_id, requested_by, student_limit, amount, utr_number, screenshot_url,
    status, payment_category, joining_fee_portion, notes,
    coupon_code, original_amount, discount_amount
  ) VALUES (
    p_org_id, auth.uid(), p_student_limit, p_amount, v_clean_utr, p_screenshot_url,
    'pending', v_cat, v_joining, nullif(trim(coalesce(p_notes, '')), ''),
    nullif(v_code, ''), v_orig, v_disc
  ) RETURNING id INTO v_payment_id;

  -- If coupon was used, record redemption & increment counter
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
        v_orig, v_disc, p_amount, auth.uid()
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
    'coupon_applied', nullif(v_code, ''),
    'discount_amount', v_disc,
    'message', 'Payment proof submitted. Your subscription will be approved shortly.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text, text, numeric, numeric) TO authenticated;
