-- =====================================================================
-- Migration 0026: Official Letterhead Notices & A4 Notice Pad Generator (14th Feature)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.official_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ref_no TEXT NOT NULL,
  notice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General Notice',
  target_audience TEXT NOT NULL DEFAULT 'All Parents / Guardians',
  signatories JSONB DEFAULT '[{"role":"Principal","name":"","enabled":true},{"role":"Director / Manager","name":"","enabled":false},{"role":"Exam Incharge / Coordinator","name":"","enabled":false}]'::jsonb,
  show_stamp BOOLEAN NOT NULL DEFAULT true,
  copies_to TEXT DEFAULT '1. School Notice Board 2. Staff Room 3. Class Teachers 4. Office Record',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_official_notices_org_date ON public.official_notices(organization_id, notice_date DESC);

ALTER TABLE public.official_notices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'official_notices' AND policyname = 'official_notices same org'
  ) THEN
    CREATE POLICY "official_notices same org" ON public.official_notices
      FOR ALL
      USING (organization_id = public.user_org_id())
      WITH CHECK (organization_id = public.user_org_id());
  END IF;
END $$;
