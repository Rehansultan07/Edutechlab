-- =====================================================================
-- Migration 0019: Watertight Platform Security, Quota Enforcers & Triggers
-- EduTechLab SaaS Platform
-- =====================================================================

-- 1. Helper Function: is_institution_paused
-- Checks both direct boolean column and JSONB fallback (_is_paused)
CREATE OR REPLACE FUNCTION public.is_institution_paused(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paused boolean := false;
  v_feat jsonb;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT coalesce(is_paused, false), enabled_features
  INTO v_paused, v_feat
  FROM public.organizations
  WHERE id = p_org_id;

  IF v_paused THEN
    RETURN true;
  END IF;

  IF v_feat IS NOT NULL AND (v_feat->>'_is_paused')::boolean = true THEN
    RETURN true;
  END IF;

  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_institution_paused(uuid) TO authenticated, anon;


-- 2. Trigger Function: enforce_student_admission_guard
-- Physically prevents admitting students if:
-- a) The institution is paused by Super Admin
-- b) The institution's subscription is expired
-- c) The student limit / capacity quota has been reached
CREATE OR REPLACE FUNCTION public.enforce_student_admission_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_count bigint;
BEGIN
  -- A. Check if the institute is paused
  IF public.is_institution_paused(NEW.organization_id) THEN
    RAISE EXCEPTION 'Action Blocked: This institution is currently paused by platform administrator.';
  END IF;

  -- B. Check subscription status & quota
  SELECT * INTO v_sub
  FROM public.institution_subscriptions
  WHERE organization_id = NEW.organization_id;

  IF v_sub.id IS NOT NULL THEN
    -- If subscription has expired and not awaiting approval
    IF v_sub.current_period_ends_at < now() AND v_sub.status NOT IN ('pending_approval') THEN
      RAISE EXCEPTION 'Action Blocked: Institute subscription has expired (valid until %). Please renew subscription to admit students.', v_sub.current_period_ends_at::date;
    END IF;

    -- If active student limit reached
    SELECT count(*) INTO v_count
    FROM public.students
    WHERE organization_id = NEW.organization_id AND status = 'active';

    IF v_count >= v_sub.student_limit THEN
      RAISE EXCEPTION 'Action Blocked: Student quota limit of % reached (% active students). Please upgrade your subscription plan.', v_sub.student_limit, v_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_student_admission_guard ON public.students;
CREATE TRIGGER trg_enforce_student_admission_guard
  BEFORE INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_student_admission_guard();


-- 3. Trigger Function: enforce_institution_pause_guard
-- Blocks recording student attendance, teacher attendance, or fee collections when paused
CREATE OR REPLACE FUNCTION public.enforce_institution_pause_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_institution_paused(NEW.organization_id) THEN
    RAISE EXCEPTION 'Action Blocked: This institution is currently paused by platform administrator.';
  END IF;
  RETURN NEW;
END;
$$;

-- Apply to Attendance
DROP TRIGGER IF EXISTS trg_enforce_attendance_pause_guard ON public.attendance;
CREATE TRIGGER trg_enforce_attendance_pause_guard
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_institution_pause_guard();

-- Apply to Fee Payments
DROP TRIGGER IF EXISTS trg_enforce_fees_pause_guard ON public.fee_payments;
CREATE TRIGGER trg_enforce_fees_pause_guard
  BEFORE INSERT OR UPDATE ON public.fee_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_institution_pause_guard();

-- Apply to School Expenses
DROP TRIGGER IF EXISTS trg_enforce_expenses_pause_guard ON public.school_expenses;
CREATE TRIGGER trg_enforce_expenses_pause_guard
  BEFORE INSERT OR UPDATE ON public.school_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_institution_pause_guard();

-- Apply to Teacher Attendance if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teacher_attendance') THEN
    DROP TRIGGER IF EXISTS trg_enforce_teacher_attendance_pause_guard ON public.teacher_attendance;
    CREATE TRIGGER trg_enforce_teacher_attendance_pause_guard
      BEFORE INSERT OR UPDATE ON public.teacher_attendance
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_institution_pause_guard();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
