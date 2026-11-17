-- Migration 0023: Add admission_date column to public.students
-- Allows institutions to record and track the exact date of admission for students (defaults to current_date)

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS admission_date date DEFAULT current_date;

-- Backfill any existing students where admission_date is NULL using their creation date
UPDATE public.students
SET admission_date = created_at::date
WHERE admission_date IS NULL;

-- Index for filtering and sorting students by admission date
CREATE INDEX IF NOT EXISTS idx_students_admission_date
  ON public.students (organization_id, admission_date);

-- Notify PostgREST to refresh its schema cache
NOTIFY pgrst, 'reload schema';
