-- =====================================================================
-- Migration 0015: Attendance Cutoff Time, Auto-Absent & Teacher Attendance
-- Enables school-configurable cutoff time, automatic marking of absent
-- students after cutoff, and daily teacher/staff attendance tracking.
-- =====================================================================

-- 1. Add attendance cutoff columns to organization_settings
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS attendance_cutoff_time text DEFAULT '09:30',
  ADD COLUMN IF NOT EXISTS auto_mark_absent boolean DEFAULT true;

-- 2. Create teacher_attendance table for daily faculty tracking
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT current_date,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'leave')) DEFAULT 'present',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, attendance_date)
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_org_date
  ON public.teacher_attendance(organization_id, attendance_date);

-- Enable RLS
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

-- Resilient RLS Policies
DROP POLICY IF EXISTS "teacher attendance same org" ON public.teacher_attendance;
CREATE POLICY "teacher attendance same org" ON public.teacher_attendance
  FOR ALL
  USING (organization_id = public.user_org_id())
  WITH CHECK (organization_id = public.user_org_id());

DROP POLICY IF EXISTS "platform admin full access teacher_attendance" ON public.teacher_attendance;
CREATE POLICY "platform admin full access teacher_attendance" ON public.teacher_attendance
  FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- 3. Atomic RPC for Single Teacher Attendance Marking
CREATE OR REPLACE FUNCTION public.mark_teacher_attendance(
  p_teacher_id uuid,
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
      'error', 'Invalid teacher attendance status: ' || coalesce(p_status, 'NULL')
    );
  END IF;

  INSERT INTO public.teacher_attendance (
    organization_id,
    teacher_id,
    attendance_date,
    status,
    note,
    created_at
  )
  VALUES (
    p_org_id,
    p_teacher_id,
    p_date,
    v_normalized_status,
    p_note,
    now()
  )
  ON CONFLICT (teacher_id, attendance_date)
  DO UPDATE SET
    status = EXCLUDED.status,
    note = coalesce(EXCLUDED.note, public.teacher_attendance.note),
    created_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', p_teacher_id,
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

GRANT EXECUTE ON FUNCTION public.mark_teacher_attendance(uuid, uuid, date, text, text) TO authenticated, anon;

-- 4. Batch RPC for Teacher Attendance (e.g. Mark All Present)
CREATE OR REPLACE FUNCTION public.save_batch_teacher_attendance(
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
  v_teacher_id uuid;
BEGIN
  IF p_records IS NULL OR jsonb_array_length(p_records) = 0 THEN
    RETURN jsonb_build_object('success', true, 'count', 0);
  END IF;

  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    BEGIN
      v_teacher_id := (v_rec->>'teacher_id')::uuid;
      v_status := lower(trim(v_rec->>'status'));

      IF v_teacher_id IS NOT NULL AND v_status IN ('present', 'absent', 'late', 'leave') THEN
        INSERT INTO public.teacher_attendance (
          organization_id,
          teacher_id,
          attendance_date,
          status,
          note,
          created_at
        )
        VALUES (
          p_org_id,
          v_teacher_id,
          p_date,
          v_status,
          v_rec->>'note',
          now()
        )
        ON CONFLICT (teacher_id, attendance_date)
        DO UPDATE SET
          status = EXCLUDED.status,
          note = coalesce(EXCLUDED.note, public.teacher_attendance.note),
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

GRANT EXECUTE ON FUNCTION public.save_batch_teacher_attendance(jsonb, uuid, date) TO authenticated, anon;

-- 5. Auto-Mark Remaining Unmarked Students as Absent After Cutoff Time
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
BEGIN
  -- Insert absent records for active students who have NO attendance marked on p_date
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
      'Auto-marked absent (Cutoff time passed)',
      now()
    FROM unmarked_students um
    ON CONFLICT (student_id, attendance_date) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted_count FROM inserted;

  RETURN jsonb_build_object(
    'success', true,
    'marked_absent_count', v_inserted_count,
    'date', p_date
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_attendance_cutoff(uuid, date) TO authenticated, anon;
