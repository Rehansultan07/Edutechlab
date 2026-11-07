-- =====================================================================
-- Migration 0020: Strict Attendance Cutoff, Absent Enforcement & Lock Guard
-- 1. mark_qr_attendance:
--    - Scans BEFORE or AT cutoff time -> marked 'present'
--    - Scans AFTER cutoff time -> strictly marked 'absent'
-- 2. mark_student_attendance:
--    - Only School Admin / Owner (or Platform Admin) can mark 'present' after cutoff time
-- 3. save_batch_attendance:
--    - Only School Admin / Owner can batch mark 'present' after cutoff time
-- 4. enforce_attendance_cutoff:
--    - Automatically upserts all unmarked students as 'absent'
-- =====================================================================

-- 1. QR Code Attendance Marking with Strict Cutoff Enforcement
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
  v_cutoff_time text := '09:30';
  v_is_past_cutoff boolean := false;
  v_final_status text := 'present';
  v_note text;
  v_now_ist_time time;
  v_cutoff_ist_time time;
  v_today_ist date;
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
  v_now_ist_time := timezone('Asia/Kolkata', now())::time;
  v_today_ist := timezone('Asia/Kolkata', now())::date;

  -- Retrieve configured cutoff time
  SELECT coalesce(attendance_cutoff_time, '09:30')
  INTO v_cutoff_time
  FROM public.organization_settings
  WHERE organization_id = p_organization_id;

  IF v_cutoff_time IS NULL OR v_cutoff_time = '' THEN
    v_cutoff_time := '09:30';
  END IF;

  -- Check if viewing today and past cutoff
  IF p_date = v_today_ist OR p_date = current_date THEN
    BEGIN
      v_cutoff_ist_time := v_cutoff_time::time;
      IF v_now_ist_time > v_cutoff_ist_time THEN
        v_is_past_cutoff := true;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_is_past_cutoff := false;
    END;
  END IF;

  -- Check if already marked today
  SELECT * INTO v_existing_att
  FROM public.attendance
  WHERE organization_id = p_organization_id
    AND student_id = v_student.id
    AND attendance_date = p_date;

  IF v_existing_att.id IS NOT NULL AND v_existing_att.status = 'present' THEN
    -- Student was already marked present before cutoff
    v_already_marked := true;
    v_final_status := 'present';
    v_note := v_existing_att.note;
  ELSIF v_is_past_cutoff THEN
    -- Scanned AFTER cutoff time! Must be marked ABSENT per strict school rule
    v_final_status := 'absent';
    v_note := 'Scanned after cutoff (' || v_cutoff_time || ') at ' || v_now || ' - Marked ABSENT';

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
      'absent',
      v_note,
      now()
    )
    ON CONFLICT (student_id, attendance_date)
    DO UPDATE SET
      status = CASE WHEN attendance.status = 'present' THEN 'present' ELSE 'absent' END,
      note = CASE WHEN attendance.status = 'present' THEN attendance.note ELSE EXCLUDED.note END;
  ELSE
    -- Scanned BEFORE cutoff time -> marked PRESENT
    v_final_status := 'present';
    v_note := 'QR Gate Scan at ' || v_now;

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
      v_note,
      now()
    )
    ON CONFLICT (student_id, attendance_date)
    DO UPDATE SET
      status = 'present',
      note = v_note,
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
      'status', v_final_status,
      'date', p_date,
      'time', v_now,
      'already_marked', v_already_marked,
      'past_cutoff', v_is_past_cutoff,
      'cutoff_time', v_cutoff_time,
      'warning', CASE
        WHEN v_is_past_cutoff AND v_final_status = 'absent'
        THEN 'Cutoff time (' || v_cutoff_time || ') passed! Marked as ABSENT. Only School Admin can mark Present.'
        ELSE NULL
      END
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

GRANT EXECUTE ON FUNCTION public.mark_qr_attendance(text, uuid, date) TO authenticated, anon;


-- 2. Single Student Attendance Marking with Role & Cutoff Validation
CREATE OR REPLACE FUNCTION public.mark_student_attendance(
  p_student_id uuid,
  p_org_id uuid,
  p_date date,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_status text;
  v_cutoff_time text := '09:30';
  v_is_past_cutoff boolean := false;
  v_caller_role text := '';
  v_caller_uid uuid;
  v_now_time time;
  v_cutoff_time_val time;
  v_today date;
BEGIN
  v_normalized_status := lower(trim(p_status));
  IF v_normalized_status NOT IN ('present', 'absent', 'late', 'leave') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid attendance status: ' || coalesce(p_status, 'NULL')
    );
  END IF;

  v_today := timezone('Asia/Kolkata', now())::date;
  v_now_time := timezone('Asia/Kolkata', now())::time;

  -- If trying to mark PRESENT on today or past date, check cutoff rule
  IF v_normalized_status = 'present' AND (p_date = v_today OR p_date = current_date) THEN
    SELECT coalesce(attendance_cutoff_time, '09:30')
    INTO v_cutoff_time
    FROM public.organization_settings
    WHERE organization_id = p_org_id;

    BEGIN
      v_cutoff_time_val := v_cutoff_time::time;
      IF v_now_time > v_cutoff_time_val THEN
        v_is_past_cutoff := true;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_is_past_cutoff := false;
    END;

    -- If past cutoff, only School Admin / Owner or Platform Admin can set 'present'
    IF v_is_past_cutoff THEN
      v_caller_uid := auth.uid();
      IF v_caller_uid IS NOT NULL THEN
        SELECT lower(coalesce(role, '')) INTO v_caller_role
        FROM public.profiles
        WHERE id = v_caller_uid;

        IF v_caller_role NOT IN ('owner', 'admin') AND NOT public.is_platform_admin() THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Cutoff time (' || v_cutoff_time || ') has passed. Only School Admin can mark students Present after cutoff.'
          );
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.attendance (
    organization_id,
    student_id,
    attendance_date,
    status,
    note,
    created_at
  )
  VALUES (
    p_org_id,
    p_student_id,
    p_date,
    v_normalized_status,
    p_note,
    now()
  )
  ON CONFLICT (student_id, attendance_date)
  DO UPDATE SET
    status = EXCLUDED.status,
    note = coalesce(EXCLUDED.note, public.attendance.note),
    created_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'student_id', p_student_id,
    'date', p_date,
    'status', v_normalized_status
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_student_attendance(uuid, uuid, date, text, text) TO authenticated, anon;


-- 3. Batch Student Attendance Marking with Role & Cutoff Validation
CREATE OR REPLACE FUNCTION public.save_batch_attendance(
  p_records jsonb,
  p_org_id uuid,
  p_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec jsonb;
  v_count int := 0;
  v_status text;
  v_student_id uuid;
  v_cutoff_time text := '09:30';
  v_is_past_cutoff boolean := false;
  v_caller_role text := '';
  v_caller_uid uuid;
  v_now_time time;
  v_cutoff_time_val time;
  v_today date;
  v_has_present boolean := false;
BEGIN
  IF p_records IS NULL OR jsonb_array_length(p_records) = 0 THEN
    RETURN jsonb_build_object('success', true, 'count', 0);
  END IF;

  v_today := timezone('Asia/Kolkata', now())::date;
  v_now_time := timezone('Asia/Kolkata', now())::time;

  -- Check if any record is being set to present
  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    IF lower(trim(v_rec->>'status')) = 'present' THEN
      v_has_present := true;
      EXIT;
    END IF;
  END LOOP;

  IF v_has_present AND (p_date = v_today OR p_date = current_date) THEN
    SELECT coalesce(attendance_cutoff_time, '09:30')
    INTO v_cutoff_time
    FROM public.organization_settings
    WHERE organization_id = p_org_id;

    BEGIN
      v_cutoff_time_val := v_cutoff_time::time;
      IF v_now_time > v_cutoff_time_val THEN
        v_is_past_cutoff := true;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_is_past_cutoff := false;
    END;

    IF v_is_past_cutoff THEN
      v_caller_uid := auth.uid();
      IF v_caller_uid IS NOT NULL THEN
        SELECT lower(coalesce(role, '')) INTO v_caller_role
        FROM public.profiles
        WHERE id = v_caller_uid;

        IF v_caller_role NOT IN ('owner', 'admin') AND NOT public.is_platform_admin() THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Cutoff time (' || v_cutoff_time || ') has passed. Only School Admin can mark students Present after cutoff.'
          );
        END IF;
      END IF;
    END IF;
  END IF;

  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    BEGIN
      v_student_id := (v_rec->>'student_id')::uuid;
      v_status := lower(trim(v_rec->>'status'));

      IF v_student_id IS NOT NULL AND v_status IN ('present', 'absent', 'late', 'leave') THEN
        INSERT INTO public.attendance (
          organization_id,
          student_id,
          attendance_date,
          status,
          note,
          created_at
        )
        VALUES (
          p_org_id,
          v_student_id,
          p_date,
          v_status,
          v_rec->>'note',
          now()
        )
        ON CONFLICT (student_id, attendance_date)
        DO UPDATE SET
          status = EXCLUDED.status,
          note = coalesce(EXCLUDED.note, public.attendance.note),
          created_at = now();

        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Continue with other records
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_count,
    'date', p_date
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_batch_attendance(jsonb, uuid, date) TO authenticated, anon;


-- 4. Fast Auto-Mark Remaining Unmarked Students as Absent
CREATE OR REPLACE FUNCTION public.enforce_attendance_cutoff(
  p_org_id uuid,
  p_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_count int := 0;
  v_cutoff_time text := '09:30';
BEGIN
  SELECT coalesce(attendance_cutoff_time, '09:30')
  INTO v_cutoff_time
  FROM public.organization_settings
  WHERE organization_id = p_org_id;

  WITH unmarked_students AS (
    SELECT s.id AS student_id
    FROM public.students s
    WHERE s.organization_id = p_org_id
      AND s.status = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM public.attendance a
        WHERE a.student_id = s.id
          AND a.attendance_date = p_date
      )
  ),
  inserted AS (
    INSERT INTO public.attendance (
      organization_id,
      student_id,
      attendance_date,
      status,
      note,
      created_at
    )
    SELECT
      p_org_id,
      um.student_id,
      p_date,
      'absent',
      'Auto-marked absent (Cutoff ' || v_cutoff_time || ' passed)',
      now()
    FROM unmarked_students um
    ON CONFLICT (student_id, attendance_date) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted_count FROM inserted;

  RETURN jsonb_build_object(
    'success', true,
    'marked_absent_count', v_inserted_count,
    'date', p_date,
    'cutoff_time', v_cutoff_time
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_attendance_cutoff(uuid, date) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
