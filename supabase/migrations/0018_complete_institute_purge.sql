-- =====================================================================
-- Migration 0018: Complete Institute Purge & Cascading Cleanup
-- EduTechLab SaaS Platform
-- =====================================================================

-- Secure RPC: delete_institution_permanently
-- Permanently purges an institution and ALL related records:
-- subscription payments, student fees, attendance, marks, homework,
-- expenses, notices, profiles, auth users, and settings.
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
  -- 1. Verify platform administrator permission or master access code
  v_is_super := public.is_platform_admin() OR (p_master_code = 'Edutechlab@#78692');
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Unauthorized: Only platform super administrators can permanently delete institutions.';
  END IF;

  -- 2. Verify target organization exists
  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'Institution with ID % not found.', p_org_id;
  END IF;

  -- 3. Collect all user IDs linked to this organization for auth purge
  SELECT array_agg(id) INTO v_user_ids
  FROM public.profiles
  WHERE organization_id = p_org_id;

  -- 4. Count records being removed for reporting
  SELECT count(*) INTO v_deleted_payments FROM public.subscription_payments WHERE organization_id = p_org_id;
  SELECT count(*) INTO v_deleted_students FROM public.students WHERE organization_id = p_org_id;

  -- 5. Cascade Delete in Strict Dependency Order:
  -- A. Subscription & Platform Billing Records
  DELETE FROM public.subscription_payments WHERE organization_id = p_org_id;
  DELETE FROM public.institution_subscriptions WHERE organization_id = p_org_id;

  -- B. Student Fees, Accounts & Expenses
  DELETE FROM public.fee_payments WHERE organization_id = p_org_id;
  DELETE FROM public.student_fee_months WHERE organization_id = p_org_id;
  DELETE FROM public.student_fee_plans WHERE organization_id = p_org_id;
  DELETE FROM public.school_expenses WHERE organization_id = p_org_id;

  -- C. Examinations, Results & Academics
  DELETE FROM public.exam_marks WHERE organization_id = p_org_id;
  DELETE FROM public.exams WHERE organization_id = p_org_id;
  DELETE FROM public.student_certificates WHERE organization_id = p_org_id;
  DELETE FROM public.class_timetables WHERE organization_id = p_org_id;
  DELETE FROM public.class_homework WHERE organization_id = p_org_id;
  DELETE FROM public.notices WHERE organization_id = p_org_id;

  -- D. Attendance Records
  DELETE FROM public.attendance WHERE organization_id = p_org_id;
  BEGIN
    DELETE FROM public.teacher_attendance WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- E. Staff, Teachers & Permissions
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

  -- F. Students & Parents
  DELETE FROM public.students WHERE organization_id = p_org_id;
  BEGIN
    DELETE FROM public.parents WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- G. Academic Structure (Sections, Classes, Sessions)
  DELETE FROM public.sections WHERE organization_id = p_org_id;
  DELETE FROM public.classes WHERE organization_id = p_org_id;
  DELETE FROM public.academic_sessions WHERE organization_id = p_org_id;

  -- H. Organization Settings
  DELETE FROM public.organization_settings WHERE organization_id = p_org_id;

  -- I. User Profiles
  DELETE FROM public.profiles WHERE organization_id = p_org_id;

  -- J. The Organization itself
  DELETE FROM public.organizations WHERE id = p_org_id;

  -- K. Auth Users (Delete login credentials of school staff/teachers, skip platform owners)
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

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.delete_institution_permanently(uuid, text) TO authenticated, anon;

-- Also support single argument version for backwards compatibility
CREATE OR REPLACE FUNCTION public.delete_institution_permanently(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.delete_institution_permanently(p_org_id, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_institution_permanently(uuid) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
