-- =====================================================================
-- MIGRATION 0025: SCHOOL RECURRING REFERRAL PERCENTAGE COMMISSION
-- Changes:
-- 1. Add referral commission percentage to platform_settings (default: 10%)
-- 2. Add reward type to platform_settings ('percentage' or 'flat')
-- 3. Add custom_referral_percentage to organizations (for per-school overrides)
-- 4. Update _credit_school_referral_bonus to award monthly percentage commission on EVERY approved subscription payment
-- 5. Update get_school_referral_and_wallet_data and admin functions
-- =====================================================================

-- 1. ALTER platform_settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS school_referral_percentage numeric NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS school_referral_reward_type text NOT NULL DEFAULT 'percentage';

-- Ensure defaults in existing rows
UPDATE public.platform_settings
SET school_referral_percentage = coalesce(school_referral_percentage, 10.00),
    school_referral_reward_type = coalesce(school_referral_reward_type, 'percentage')
WHERE id = 'global';

-- 2. ALTER organizations for optional custom percentage per school
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS custom_referral_percentage numeric DEFAULT NULL;

-- 3. RECURRING PERCENTAGE REFERRAL COMMISSION INTERNAL HELPER
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
  v_base_amount numeric := 0;
  v_referral_percent numeric := 10.00;
  v_reward_type text := 'percentage';
  v_flat_amount numeric := 500.00;
  v_bonus_amount numeric := 0;
  v_already_rewarded boolean;
  v_desc text;
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
  SELECT id, name, custom_referral_percentage INTO v_ref_org
  FROM public.organizations
  WHERE id = v_org.referred_by_org_id;

  IF v_ref_org.id IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Referring school record not found.');
  END IF;

  -- Prevent duplicate crediting for the EXACT SAME payment ID
  SELECT EXISTS (
    SELECT 1 FROM public.institution_wallet_transactions
    WHERE organization_id = v_org.referred_by_org_id
      AND source_payment_id = p_payment_id
      AND transaction_type = 'referral_bonus'
  ) INTO v_already_rewarded;

  IF v_already_rewarded THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Referral commission already credited for this payment.');
  END IF;

  -- Fetch reward setting from platform_settings
  SELECT
    coalesce(school_referral_percentage, 10.00),
    coalesce(school_referral_reward_type, 'percentage'),
    coalesce(school_referral_bonus_amount, 500.00)
  INTO v_referral_percent, v_reward_type, v_flat_amount
  FROM public.platform_settings
  WHERE id = 'global';

  -- Check if referring school has an individual custom commission rate
  IF v_ref_org.custom_referral_percentage IS NOT NULL AND v_ref_org.custom_referral_percentage > 0 THEN
    v_referral_percent := v_ref_org.custom_referral_percentage;
  END IF;

  -- Calculate bonus amount based on mode
  IF v_reward_type = 'percentage' THEN
    -- Base calculation on the package/original amount or net paid amount
    v_base_amount := round(greatest(coalesce(v_pay.original_amount, 0), coalesce(v_pay.amount, 0)), 2);
    IF v_base_amount <= 0 THEN
      v_base_amount := round(coalesce(v_pay.amount, 0), 2);
    END IF;

    IF v_base_amount <= 0 THEN
      RETURN jsonb_build_object('credited', false, 'reason', 'Payment base amount is 0, skipping commission.');
    END IF;

    v_bonus_amount := round((v_base_amount * v_referral_percent / 100.0), 2);
    v_desc := 'Referral recurring commission (' || v_referral_percent || '%): ' || v_org.name || ' subscription payment of ₹' || v_base_amount || '!';
  ELSE
    -- Flat amount mode fallback
    v_bonus_amount := round(v_flat_amount, 2);
    v_desc := 'Referral reward: ' || v_org.name || ' subscription activated!';
  END IF;

  IF v_bonus_amount <= 0 THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Calculated bonus amount is 0.');
  END IF;

  -- Credit Referrer's Virtual Wallet
  INSERT INTO public.institution_wallets (organization_id, balance, total_earned, total_spent, updated_at)
  VALUES (v_ref_org.id, v_bonus_amount, v_bonus_amount, 0.00, now())
  ON CONFLICT (organization_id) DO UPDATE
  SET balance = public.institution_wallets.balance + v_bonus_amount,
      total_earned = public.institution_wallets.total_earned + v_bonus_amount,
      updated_at = now();

  -- Record in Wallet Ledger
  INSERT INTO public.institution_wallet_transactions (
    organization_id, amount, transaction_type, source_payment_id,
    referred_org_id, referred_org_name, description
  ) VALUES (
    v_ref_org.id, v_bonus_amount, 'referral_bonus', p_payment_id,
    v_org.id, v_org.name, v_desc
  );

  RETURN jsonb_build_object(
    'credited', true,
    'bonus_amount', v_bonus_amount,
    'percentage', v_referral_percent,
    'reward_type', v_reward_type,
    'referrer_id', v_ref_org.id,
    'referrer_name', v_ref_org.name,
    'referred_school', v_org.name
  );
END;
$$;

-- 4. UPDATE get_school_referral_and_wallet_data RPC
CREATE OR REPLACE FUNCTION public.get_school_referral_and_wallet_data(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
  v_wallet record;
  v_referral_percent numeric := 10.00;
  v_reward_type text := 'percentage';
  v_flat_bonus numeric := 500.00;
  v_effective_percent numeric;
  v_referred_schools jsonb;
  v_transactions jsonb;
BEGIN
  IF p_org_id != public.user_org_id() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  SELECT id, name, referral_code, custom_referral_percentage, created_at INTO v_org
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

  -- Platform settings
  SELECT
    coalesce(school_referral_percentage, 10.00),
    coalesce(school_referral_reward_type, 'percentage'),
    coalesce(school_referral_bonus_amount, 500.00)
  INTO v_referral_percent, v_reward_type, v_flat_bonus
  FROM public.platform_settings
  WHERE id = 'global';

  v_effective_percent := coalesce(v_org.custom_referral_percentage, v_referral_percent);

  -- List of referred schools with aggregate commission earned
  SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_referred_schools
  FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'created_at', o.created_at,
      'status', coalesce(s.status, 'trial'),
      'is_trial', coalesce(s.is_trial, true),
      'bonus_earned', coalesce(t.total_bonus, 0),
      'rewards_count', coalesce(t.rewards_count, 0),
      'is_rewarded', (t.total_bonus IS NOT NULL AND t.total_bonus > 0)
    ) AS row_data,
    o.created_at
    FROM public.organizations o
    LEFT JOIN public.institution_subscriptions s ON s.organization_id = o.id
    LEFT JOIN (
      SELECT referred_org_id, sum(amount) AS total_bonus, count(*) AS rewards_count
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
    'referral_percentage', v_effective_percent,
    'reward_type', v_reward_type,
    'bonus_rate_per_school', v_flat_bonus,
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

-- 5. UPDATE admin_list_school_wallets RPC
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
  v_referral_percent numeric;
  v_reward_type text;
  v_flat_bonus numeric;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  SELECT
    coalesce(school_referral_percentage, 10.00),
    coalesce(school_referral_reward_type, 'percentage'),
    coalesce(school_referral_bonus_amount, 500.00)
  INTO v_referral_percent, v_reward_type, v_flat_bonus
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
      'custom_referral_percentage', o.custom_referral_percentage,
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
    'referral_percentage', v_referral_percent,
    'reward_type', v_reward_type,
    'bonus_rate_per_school', v_flat_bonus,
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

-- 6. SUPER ADMIN RPC: UPDATE SCHOOL REFERRAL REWARD (Supports Percentage & Flat mode)
DROP FUNCTION IF EXISTS public.admin_update_school_referral_reward(numeric, text);
DROP FUNCTION IF EXISTS public.admin_update_school_referral_reward(numeric, text, numeric, text);

CREATE OR REPLACE FUNCTION public.admin_update_school_referral_reward(
  p_percentage numeric DEFAULT 10.00,
  p_reward_type text DEFAULT 'percentage',
  p_flat_amount numeric DEFAULT 500.00,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_percent numeric;
  v_flat numeric;
  v_type text;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  v_percent := round(greatest(0, least(100, coalesce(p_percentage, 10.00))), 2);
  v_flat := round(greatest(0, coalesce(p_flat_amount, 500.00)), 2);
  v_type := CASE WHEN lower(trim(coalesce(p_reward_type, 'percentage'))) = 'flat' THEN 'flat' ELSE 'percentage' END;

  UPDATE public.platform_settings
  SET school_referral_percentage = v_percent,
      school_referral_reward_type = v_type,
      school_referral_bonus_amount = v_flat,
      updated_at = now()
  WHERE id = 'global';

  RETURN jsonb_build_object(
    'success', true,
    'percentage', v_percent,
    'reward_type', v_type,
    'bonus_amount', v_flat,
    'message', CASE
      WHEN v_type = 'percentage' THEN 'School referral reward set to ' || v_percent || '% recurring commission on every monthly subscription payment.'
      ELSE 'School referral reward set to ₹' || v_flat || ' flat per school onboarding.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_school_referral_reward(numeric, text, numeric, text) TO authenticated, anon;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
