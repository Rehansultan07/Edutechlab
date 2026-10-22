-- =====================================================================
-- Migration 0008: QR Code Student Verification & Gate Attendance Kiosk
-- EduTechLab SaaS Platform
-- =====================================================================

CREATE OR REPLACE FUNCTION public.mark_qr_attendance(
  p_admission_no text,
  p_organization_id uuid,
  p_date date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_adm text;
  v_student record;
  v_class_name text;
  v_section_name text;
  v_existing_att record;
  v_already_marked boolean := false;
  v_fee_due numeric := 0;
  v_due_months_count int := 0;
  v_now text;
BEGIN
  v_clean_adm := trim(p_admission_no);
  
  -- Extract admission number if full URL or prefix was scanned
  IF v_clean_adm ~* 'id=' THEN
    v_clean_adm := regexp_replace(v_clean_adm, '^.*[?&]id=([^&]+).*$', '\\1', 'i');
    v_clean_adm := replace(v_clean_adm, '%20', ' ');
  ELSIF v_clean_adm ~* '^EDUID:' THEN
    v_clean_adm := regexp_replace(v_clean_adm, '^EDUID:', '', 'i');
  END IF;
  v_clean_adm := trim(v_clean_adm);

  IF v_clean_adm = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admission number cannot be empty.');
  END IF;

  -- Lookup student in this organization
  SELECT s.* INTO v_student
  FROM public.students s
  WHERE s.organization_id = p_organization_id
    AND lower(s.admission_no) = lower(v_clean_adm)
    AND s.status = 'active'
  LIMIT 1;

  IF v_student.id IS NULL THEN
    SELECT s.* INTO v_student
    FROM public.students s
    WHERE s.organization_id = p_organization_id
      AND (s.id::text = v_clean_adm OR lower(s.admission_no) = lower(v_clean_adm))
    LIMIT 1;
  END IF;

  IF v_student.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student with Admission/ID "' || v_clean_adm || '" not found in this institute.'
    );
  END IF;

  -- Class & Section
  SELECT name INTO v_class_name FROM public.classes WHERE id = v_student.class_id;
  SELECT name INTO v_section_name FROM public.sections WHERE id = v_student.section_id;

  v_now := to_char(timezone('Asia/Kolkata', now()), 'HH12:MI AM');

  -- Check if already marked today
  SELECT * INTO v_existing_att
  FROM public.attendance
  WHERE organization_id = p_organization_id
    AND student_id = v_student.id
    AND attendance_date = p_date;

  IF v_existing_att.id IS NOT NULL AND v_existing_att.status = 'present' THEN
    v_already_marked := true;
  ELSE
    INSERT INTO public.attendance (
      organization_id,
      student_id,
      attendance_date,
      status,
      note,
      created_at
    )
    VALUES (
      p_organization_id,
      v_student.id,
      p_date,
      'present',
      'QR Gate Scan at ' || v_now,
      now()
    )
    ON CONFLICT (student_id, attendance_date)
    DO UPDATE SET
      status = 'present',
      note = 'QR Gate Scan at ' || v_now,
      created_at = now();
  END IF;

  -- Calculate fee dues
  SELECT
    coalesce(sum(amount_due - amount_paid), 0),
    count(*) filter (where status in ('due', 'partial'))
  INTO v_fee_due, v_due_months_count
  FROM public.student_fee_months
  WHERE student_id = v_student.id;

  RETURN jsonb_build_object(
    'success', true,
    'student', jsonb_build_object(
      'id', v_student.id,
      'admission_no', v_student.admission_no,
      'first_name', v_student.first_name,
      'last_name', v_student.last_name,
      'full_name', trim(v_student.first_name || ' ' || coalesce(v_student.last_name, '')),
      'class_name', coalesce(v_class_name, 'General'),
      'section_name', coalesce(v_section_name, ''),
      'photo_url', v_student.photo_url,
      'phone', v_student.phone,
      'father_name', v_student.father_name
    ),
    'attendance', jsonb_build_object(
      'status', 'present',
      'date', p_date,
      'time', v_now,
      'already_marked', v_already_marked
    ),
    'fee', jsonb_build_object(
      'has_dues', v_fee_due > 0,
      'due_amount', v_fee_due,
      'due_months_count', v_due_months_count,
      'status_text', CASE 
        WHEN v_fee_due > 0 THEN 'Fee Due: ₹' || v_fee_due::text 
        ELSE 'All Fees Cleared ✓' 
      END
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_qr_profile(
  p_admission_no text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_adm text;
  v_student record;
  v_org record;
  v_class_name text;
  v_section_name text;
  v_today_att record;
  v_fee_due numeric := 0;
  v_total_paid numeric := 0;
  v_due_months_count int := 0;
BEGIN
  v_clean_adm := trim(p_admission_no);
  IF v_clean_adm ~* 'id=' THEN
    v_clean_adm := regexp_replace(v_clean_adm, '^.*[?&]id=([^&]+).*$', '\\1', 'i');
    v_clean_adm := replace(v_clean_adm, '%20', ' ');
  END IF;
  v_clean_adm := trim(v_clean_adm);

  SELECT s.* INTO v_student
  FROM public.students s
  WHERE lower(s.admission_no) = lower(v_clean_adm)
  LIMIT 1;

  IF v_student.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student record with Admission No "' || v_clean_adm || '" was not found.'
    );
  END IF;

  SELECT o.name, s.logo_url, s.phone, s.address, s.primary_color
  INTO v_org
  FROM public.organizations o
  LEFT JOIN public.organization_settings s ON s.organization_id = o.id
  WHERE o.id = v_student.organization_id;

  SELECT name INTO v_class_name FROM public.classes WHERE id = v_student.class_id;
  SELECT name INTO v_section_name FROM public.sections WHERE id = v_student.section_id;

  SELECT * INTO v_today_att
  FROM public.attendance
  WHERE student_id = v_student.id
    AND attendance_date = current_date;

  SELECT
    coalesce(sum(amount_due - amount_paid), 0),
    count(*) filter (where status in ('due', 'partial'))
  INTO v_fee_due, v_due_months_count
  FROM public.student_fee_months
  WHERE student_id = v_student.id;

  SELECT coalesce(sum(amount), 0) INTO v_total_paid
  FROM public.fee_payments
  WHERE student_id = v_student.id;

  RETURN jsonb_build_object(
    'success', true,
    'student', jsonb_build_object(
      'admission_no', v_student.admission_no,
      'full_name', trim(v_student.first_name || ' ' || coalesce(v_student.last_name, '')),
      'class_name', coalesce(v_class_name, 'General'),
      'section_name', coalesce(v_section_name, ''),
      'photo_url', v_student.photo_url,
      'gender', v_student.gender,
      'date_of_birth', v_student.date_of_birth,
      'father_name', v_student.father_name,
      'emergency_phone', coalesce(v_student.phone, v_student.guardian_phone),
      'status', v_student.status
    ),
    'institution', jsonb_build_object(
      'name', v_org.name,
      'logo_url', v_org.logo_url,
      'phone', v_org.phone,
      'address', v_org.address,
      'primary_color', v_org.primary_color
    ),
    'attendance_today', jsonb_build_object(
      'marked', v_today_att.id IS NOT NULL,
      'status', coalesce(v_today_att.status, 'not_marked'),
      'date', current_date,
      'time', CASE WHEN v_today_att.created_at IS NOT NULL 
        THEN to_char(timezone('Asia/Kolkata', v_today_att.created_at), 'HH12:MI AM') 
        ELSE NULL 
      END
    ),
    'fees', jsonb_build_object(
      'has_dues', v_fee_due > 0,
      'due_amount', v_fee_due,
      'total_paid', v_total_paid,
      'due_months_count', v_due_months_count,
      'status_message', CASE
        WHEN v_fee_due > 0 THEN '⚠️ Pending Fee Dues: ₹' || v_fee_due::text || ' (' || v_due_months_count::text || ' Month(s) Pending)'
        ELSE '✅ All School Fees Cleared'
      END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_qr_attendance(text, uuid, date) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_student_qr_profile(text) TO authenticated, anon;
