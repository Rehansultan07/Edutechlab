-- =====================================================================
-- Migration 0016: Safe Cutoff Columns, Student Roll No & Schema Reload
-- =====================================================================

-- 1. Ensure organization_settings has attendance_cutoff_time and auto_mark_absent
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS attendance_cutoff_time text DEFAULT '09:30',
  ADD COLUMN IF NOT EXISTS auto_mark_absent boolean DEFAULT true;

-- 2. Ensure students table has roll_no column
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS roll_no text;

-- 3. Ensure teacher_attendance table exists
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

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_org_date
  ON public.teacher_attendance(organization_id, attendance_date);

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

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

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
