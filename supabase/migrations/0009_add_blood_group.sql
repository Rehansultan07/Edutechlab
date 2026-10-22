-- =====================================================
-- Migration 0009: Add blood_group column to students table
-- =====================================================

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS blood_group text;
