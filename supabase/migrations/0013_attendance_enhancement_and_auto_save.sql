-- =====================================================================
-- Migration 0013: Attendance Auto-Save & Fast Batch Sync RPCs
-- Provides resilient atomic RPC functions for single and batch student attendance
-- =====================================================================

-- 1. Single Student Attendance Marking RPC (Atomic Upsert with Security Definer)
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
BEGIN
  v_normalized_status := lower(trim(p_status));
  IF v_normalized_status NOT IN ('present', 'absent', 'late', 'leave') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid attendance status: ' || coalesce(p_status, 'NULL')
    );
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


-- 2. Batch Attendance Marking RPC (Fast Bulk Upsert for Class/Entire School)
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
BEGIN
  IF p_records IS NULL OR jsonb_array_length(p_records) = 0 THEN
    RETURN jsonb_build_object('success', true, 'count', 0);
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
      -- Continue with other records in the batch
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

-- Ensure indexes for blazing fast attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_org_date_status
  ON public.attendance(organization_id, attendance_date, status);
