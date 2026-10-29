-- =====================================================================
-- Migration 0014: Platform Public Contact, Website Branding & Rates
-- Allows Super Admin to dynamically update WhatsApp, Email, Phone,
-- Announcement bar, Address, and Standard/Pro pricing rates.
-- =====================================================================

-- 1. Alter public.platform_settings to add new branding and contact fields
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS whatsapp_number text DEFAULT '917903178550',
  ADD COLUMN IF NOT EXISTS brand_name text DEFAULT 'EduTechLab',
  ADD COLUMN IF NOT EXISTS brand_tagline text DEFAULT 'Bharat Ka Sabse Fast & Aasan School Management Software',
  ADD COLUMN IF NOT EXISTS company_address text DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS announcement_text text DEFAULT 'NEW v2.0: Bharat Ka Sabse Fast & Aasan School Management Software • Risk-Free Trial!',
  ADD COLUMN IF NOT EXISTS announcement_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS youtube_demo_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS standard_rate numeric DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS pro_rate numeric DEFAULT 7.00;

-- 2. Ensure initial row exists
INSERT INTO public.platform_settings (
  id, base_price, base_students, extra_student_rate, default_trial_days,
  upi_id, upi_name, contact_phone, contact_email,
  whatsapp_number, brand_name, brand_tagline, company_address,
  announcement_text, announcement_active, standard_rate, pro_rate
)
VALUES (
  'global', 149.00, 20, 7.00, 15,
  'edutechlab@upi', 'EduTechLab Platform', '+91 79031 78550', 'edutechlab@gmail.com',
  '917903178550', 'EduTechLab', 'Bharat Ka Sabse Fast & Aasan School Management Software', 'India',
  'NEW v2.0: Bharat Ka Sabse Fast & Aasan School Management Software • Risk-Free Trial!', true, 5.00, 7.00
)
ON CONFLICT (id) DO UPDATE SET
  whatsapp_number = coalesce(public.platform_settings.whatsapp_number, excluded.whatsapp_number),
  brand_name = coalesce(public.platform_settings.brand_name, excluded.brand_name),
  standard_rate = coalesce(public.platform_settings.standard_rate, excluded.standard_rate),
  pro_rate = coalesce(public.platform_settings.pro_rate, excluded.pro_rate);

-- 3. Comprehensive RPC to Save All Platform Settings with Security Definer
CREATE OR REPLACE FUNCTION public.admin_save_platform_settings_v2(
  p_base_price numeric DEFAULT 149.00,
  p_base_students integer DEFAULT 20,
  p_extra_student_rate numeric DEFAULT 7.00,
  p_default_trial_days integer DEFAULT 15,
  p_upi_id text DEFAULT 'edutechlab@upi',
  p_upi_name text DEFAULT 'EduTechLab Platform',
  p_contact_phone text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_upi_qr_url text DEFAULT NULL,
  p_whatsapp_number text DEFAULT NULL,
  p_brand_name text DEFAULT NULL,
  p_brand_tagline text DEFAULT NULL,
  p_company_address text DEFAULT NULL,
  p_announcement_text text DEFAULT NULL,
  p_announcement_active boolean DEFAULT true,
  p_youtube_demo_url text DEFAULT NULL,
  p_standard_rate numeric DEFAULT 5.00,
  p_pro_rate numeric DEFAULT 7.00,
  p_master_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_platform_admin() OR p_master_code = 'Edutechlab@#78692') THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  UPDATE public.platform_settings
  SET
    base_price = coalesce(p_base_price, base_price),
    base_students = coalesce(p_base_students, base_students),
    extra_student_rate = coalesce(p_extra_student_rate, extra_student_rate),
    default_trial_days = coalesce(p_default_trial_days, default_trial_days),
    upi_id = coalesce(trim(p_upi_id), upi_id),
    upi_name = coalesce(trim(p_upi_name), upi_name),
    contact_phone = coalesce(trim(p_contact_phone), contact_phone),
    contact_email = coalesce(trim(p_contact_email), contact_email),
    upi_qr_url = coalesce(p_upi_qr_url, upi_qr_url),
    whatsapp_number = coalesce(trim(p_whatsapp_number), whatsapp_number),
    brand_name = coalesce(trim(p_brand_name), brand_name),
    brand_tagline = coalesce(trim(p_brand_tagline), brand_tagline),
    company_address = coalesce(trim(p_company_address), company_address),
    announcement_text = coalesce(trim(p_announcement_text), announcement_text),
    announcement_active = coalesce(p_announcement_active, announcement_active),
    youtube_demo_url = coalesce(trim(p_youtube_demo_url), youtube_demo_url),
    standard_rate = coalesce(p_standard_rate, standard_rate),
    pro_rate = coalesce(p_pro_rate, pro_rate),
    updated_at = now()
  WHERE id = 'global';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Website and platform settings updated successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_save_platform_settings_v2 TO authenticated, anon;

-- Ensure public can read platform_settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anyone can read platform_settings' AND tablename = 'platform_settings') THEN
    CREATE POLICY "anyone can read platform_settings" ON public.platform_settings FOR SELECT USING (true);
  END IF;
END $$;
