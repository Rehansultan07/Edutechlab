-- =====================================================================
-- EDUTECHLAB SAAS: SUBSCRIPTION, BILLING, QUOTA & TENANT LIFECYCLE
-- =====================================================================

-- 1. Global Platform Settings Table
create table if not exists public.platform_settings (
  id text primary key default 'global',
  base_price numeric not null default 149.00,
  base_students integer not null default 20,
  extra_student_rate numeric not null default 7.00,
  default_trial_days integer not null default 15,
  upi_id text not null default 'edutechlab@upi',
  upi_name text not null default 'EduTechLab Platform',
  upi_qr_url text,
  contact_email text not null default 'edutechlab@gmail.com',
  contact_phone text default '+91 98765 43210',
  updated_at timestamptz not null default now()
);

-- Seed default global settings if not exists
insert into public.platform_settings (id, base_price, base_students, extra_student_rate, default_trial_days, upi_id, upi_name)
values ('global', 149.00, 20, 7.00, 15, 'edutechlab@upi', 'EduTechLab Platform')
on conflict (id) do nothing;

-- 2. Institution Subscriptions Table
create table if not exists public.institution_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_type text not null default 'trial' check (plan_type in ('trial', 'standard', 'custom')),
  student_limit integer not null default 20,
  monthly_amount numeric not null default 149.00,
  status text not null default 'trial' check (status in ('trial', 'active', 'pending_approval', 'expired', 'suspended')),
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz not null default now(),
  current_period_ends_at timestamptz not null,
  is_trial boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Subscription Payments / Proofs Table
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  student_limit integer not null default 20,
  amount numeric not null,
  duration_months integer not null default 1,
  payment_method text not null default 'upi_qr',
  utr_number text not null,
  screenshot_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.platform_settings enable row level security;
alter table public.institution_subscriptions enable row level security;
alter table public.subscription_payments enable row level security;

-- Policies for platform_settings: Anyone can read, only super admins can update
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'anyone can read platform_settings' and tablename = 'platform_settings') then
    create policy "anyone can read platform_settings" on public.platform_settings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'super admins manage platform_settings' and tablename = 'platform_settings') then
    create policy "super admins manage platform_settings" on public.platform_settings for all
    to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
  end if;
end $$;

-- Policies for institution_subscriptions:
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'org members view subscription' and tablename = 'institution_subscriptions') then
    create policy "org members view subscription" on public.institution_subscriptions for select
    to authenticated using (organization_id = public.user_org_id() or public.is_platform_admin());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'super admins manage subscriptions' and tablename = 'institution_subscriptions') then
    create policy "super admins manage subscriptions" on public.institution_subscriptions for all
    to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
  end if;
end $$;

-- Policies for subscription_payments:
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'org admins manage own payments' and tablename = 'subscription_payments') then
    create policy "org admins manage own payments" on public.subscription_payments for all
    to authenticated using (organization_id = public.user_org_id() or public.is_platform_admin())
    with check (organization_id = public.user_org_id() or public.is_platform_admin());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Seed existing organizations into institution_subscriptions if missing
-- ---------------------------------------------------------------------
insert into public.institution_subscriptions (
  organization_id, plan_type, student_limit, monthly_amount, status,
  trial_ends_at, current_period_starts_at, current_period_ends_at, is_trial
)
select
  o.id,
  'trial',
  20,
  149.00,
  'trial',
  now() + interval '15 days',
  now(),
  now() + interval '15 days',
  true
from public.organizations o
where not exists (
  select 1 from public.institution_subscriptions s where s.organization_id = o.id
);

-- ---------------------------------------------------------------------
-- STORAGE BUCKETS
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('subscription-proofs', 'subscription-proofs', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('platform-assets', 'platform-assets', true)
on conflict (id) do nothing;

-- Storage policies
do $$
begin
  create policy "public read subscription-proofs"
    on storage.objects for select
    using (bucket_id in ('subscription-proofs', 'platform-assets'));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "authenticated upload subscription-proofs"
    on storage.objects for insert
    to authenticated
    with check (bucket_id in ('subscription-proofs', 'platform-assets'));
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- STORED PROCEDURES (RPCs)
-- ---------------------------------------------------------------------

-- 1. Get institution subscription details with live quota usage
create or replace function public.get_institution_subscription(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_settings record;
  v_student_count bigint;
  v_last_payment record;
  v_days_remaining integer;
  v_is_expired boolean;
begin
  if p_org_id != public.user_org_id() and not public.is_platform_admin() then
    raise exception 'Unauthorized: cross-tenant access denied.';
  end if;

  select * into v_settings from public.platform_settings where id = 'global';

  -- Auto-create trial if missing
  insert into public.institution_subscriptions (
    organization_id, plan_type, student_limit, monthly_amount, status,
    trial_ends_at, current_period_starts_at, current_period_ends_at, is_trial
  ) values (
    p_org_id, 'trial', coalesce(v_settings.base_students, 20),
    coalesce(v_settings.base_price, 149.00), 'trial',
    now() + (coalesce(v_settings.default_trial_days, 15) * interval '1 day'),
    now(),
    now() + (coalesce(v_settings.default_trial_days, 15) * interval '1 day'),
    true
  ) on conflict (organization_id) do nothing;

  select * into v_sub from public.institution_subscriptions where organization_id = p_org_id;

  select count(*) into v_student_count
  from public.students
  where organization_id = p_org_id and status = 'active';

  select * into v_last_payment
  from public.subscription_payments
  where organization_id = p_org_id
  order by created_at desc
  limit 1;

  v_days_remaining := greatest(0, ceil(extract(epoch from (v_sub.current_period_ends_at - now())) / 86400)::integer);
  v_is_expired := now() > v_sub.current_period_ends_at;

  return jsonb_build_object(
    'id', v_sub.id,
    'organization_id', v_sub.organization_id,
    'plan_type', v_sub.plan_type,
    'status', case when v_is_expired and v_sub.status not in ('pending_approval') then 'expired' else v_sub.status end,
    'student_limit', v_sub.student_limit,
    'current_student_count', v_student_count,
    'monthly_amount', v_sub.monthly_amount,
    'is_trial', v_sub.is_trial,
    'trial_ends_at', v_sub.trial_ends_at,
    'current_period_starts_at', v_sub.current_period_starts_at,
    'current_period_ends_at', v_sub.current_period_ends_at,
    'days_remaining', v_days_remaining,
    'is_expired', v_is_expired,
    'can_admit_students', (v_student_count < v_sub.student_limit and (not v_is_expired or v_sub.status = 'pending_approval')),
    'pricing', jsonb_build_object(
      'base_price', v_settings.base_price,
      'base_students', v_settings.base_students,
      'extra_student_rate', v_settings.extra_student_rate,
      'default_trial_days', v_settings.default_trial_days,
      'upi_id', v_settings.upi_id,
      'upi_name', v_settings.upi_name,
      'upi_qr_url', v_settings.upi_qr_url,
      'contact_phone', v_settings.contact_phone,
      'contact_email', v_settings.contact_email
    ),
    'latest_payment', case when v_last_payment.id is not null then jsonb_build_object(
      'id', v_last_payment.id,
      'student_limit', v_last_payment.student_limit,
      'amount', v_last_payment.amount,
      'utr_number', v_last_payment.utr_number,
      'screenshot_url', v_last_payment.screenshot_url,
      'status', v_last_payment.status,
      'rejection_reason', v_last_payment.rejection_reason,
      'created_at', v_last_payment.created_at
    ) else null end
  );
end;
$$;

-- 2. Submit Subscription Payment (School Admin)
create or replace function public.submit_subscription_payment(
  p_org_id uuid,
  p_student_limit integer,
  p_amount numeric,
  p_utr_number text,
  p_screenshot_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_utr text;
  v_payment_id uuid;
begin
  if p_org_id != public.user_org_id() and not public.is_platform_admin() then
    raise exception 'Unauthorized.';
  end if;

  v_clean_utr := trim(p_utr_number);
  if v_clean_utr = '' then
    raise exception 'UTR / Transaction Reference number is required.';
  end if;

  if p_student_limit < 1 then
    raise exception 'Student limit must be at least 1.';
  end if;

  -- Insert payment request
  insert into public.subscription_payments (
    organization_id, requested_by, student_limit, amount, utr_number, screenshot_url, status
  ) values (
    p_org_id, auth.uid(), p_student_limit, p_amount, v_clean_utr, p_screenshot_url, 'pending'
  ) returning id into v_payment_id;

  -- Update institution subscription status to pending_approval
  update public.institution_subscriptions
  set
    status = 'pending_approval',
    updated_at = now()
  where organization_id = p_org_id;

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'message', 'Payment proof submitted successfully. Super Admin will verify and activate your subscription.'
  );
end;
$$;

-- 3. Approve Subscription Payment (Super Admin Only)
create or replace function public.approve_subscription_payment(
  p_payment_id uuid,
  p_duration_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay record;
  v_curr_end timestamptz;
  v_new_end timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'Unauthorized: Only platform super administrators can approve subscription payments.';
  end if;

  select * into v_pay from public.subscription_payments where id = p_payment_id;
  if v_pay.id is null then
    raise exception 'Payment record not found.';
  end if;

  select current_period_ends_at into v_curr_end
  from public.institution_subscriptions
  where organization_id = v_pay.organization_id;

  -- If already expired, start from now; otherwise add days to existing period
  if v_curr_end is null or v_curr_end < now() then
    v_new_end := now() + (coalesce(p_duration_days, 30) * interval '1 day');
  else
    v_new_end := v_curr_end + (coalesce(p_duration_days, 30) * interval '1 day');
  end if;

  -- Mark payment as approved
  update public.subscription_payments
  set
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    rejection_reason = null,
    updated_at = now()
  where id = p_payment_id;

  -- Update subscription state
  update public.institution_subscriptions
  set
    plan_type = 'standard',
    status = 'active',
    is_trial = false,
    student_limit = v_pay.student_limit,
    monthly_amount = v_pay.amount,
    current_period_starts_at = now(),
    current_period_ends_at = v_new_end,
    updated_at = now()
  where organization_id = v_pay.organization_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Subscription approved and activated successfully.',
    'new_period_ends_at', v_new_end,
    'student_limit', v_pay.student_limit
  );
end;
$$;

-- 4. Reject Subscription Payment (Super Admin Only)
create or replace function public.reject_subscription_payment(
  p_payment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay record;
begin
  if not public.is_platform_admin() then
    raise exception 'Unauthorized: Only platform super administrators can reject subscription payments.';
  end if;

  select * into v_pay from public.subscription_payments where id = p_payment_id;
  if v_pay.id is null then
    raise exception 'Payment record not found.';
  end if;

  update public.subscription_payments
  set
    status = 'rejected',
    rejection_reason = coalesce(trim(p_reason), 'Payment could not be verified. Please check UTR and re-submit.'),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_payment_id;

  -- Revert status back to active or trial or expired
  update public.institution_subscriptions
  set
    status = case
      when current_period_ends_at < now() then 'expired'
      when is_trial then 'trial'
      else 'active'
    end,
    updated_at = now()
  where organization_id = v_pay.organization_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Subscription payment request rejected.'
  );
end;
$$;

-- 5. Mid-month Quota Override & Plan Extension (Super Admin Only)
create or replace function public.update_institution_subscription_quota(
  p_org_id uuid,
  p_student_limit integer,
  p_status text default null,
  p_extend_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_new_end timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'Unauthorized: Super admin privileges required.';
  end if;

  select * into v_sub from public.institution_subscriptions where organization_id = p_org_id;
  if v_sub.id is null then
    raise exception 'Subscription record not found.';
  end if;

  v_new_end := v_sub.current_period_ends_at;
  if p_extend_days is not null and p_extend_days > 0 then
    if v_new_end < now() then
      v_new_end := now() + (p_extend_days * interval '1 day');
    else
      v_new_end := v_new_end + (p_extend_days * interval '1 day');
    end if;
  end if;

  update public.institution_subscriptions
  set
    student_limit = coalesce(p_student_limit, student_limit),
    status = coalesce(p_status, status),
    current_period_ends_at = v_new_end,
    updated_at = now()
  where organization_id = p_org_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Subscription quota and duration updated successfully.',
    'student_limit', coalesce(p_student_limit, v_sub.student_limit),
    'current_period_ends_at', v_new_end
  );
end;
$$;

-- 6. Permanent Institution Deletion (Super Admin Only)
create or replace function public.delete_institution_permanently(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_name text;
  v_user_ids uuid[];
  v_uid uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Unauthorized: Only platform super administrators can permanently delete institutions.';
  end if;

  select name into v_org_name from public.organizations where id = p_org_id;
  if v_org_name is null then
    raise exception 'Institution not found.';
  end if;

  -- Collect all users associated with this organization (owners, staff, teachers)
  select array_agg(id) into v_user_ids
  from public.profiles
  where organization_id = p_org_id;

  -- Delete organization (cascades to all public tables)
  delete from public.organizations where id = p_org_id;

  -- Delete auth users if they belong solely to this deleted institute
  if v_user_ids is not null and array_length(v_user_ids, 1) > 0 then
    foreach v_uid in array v_user_ids loop
      -- Do not delete platform super admins accidentally!
      if not exists (select 1 from public.platform_admins where user_id = v_uid) then
        delete from auth.users where id = v_uid;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Institution "' || v_org_name || '" and all related data have been permanently deleted.'
  );
end;
$$;

-- 7. Check Student Admission Quota
create or replace function public.check_student_admission_quota(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_count bigint;
  v_allowed boolean;
begin
  select * into v_sub from public.institution_subscriptions where organization_id = p_org_id;
  if v_sub.id is null then
    return jsonb_build_object('allowed', true, 'current', 0, 'limit', 20);
  end if;

  select count(*) into v_count from public.students where organization_id = p_org_id and status = 'active';

  v_allowed := (v_count < v_sub.student_limit) and (v_sub.current_period_ends_at >= now() or v_sub.status = 'pending_approval');

  return jsonb_build_object(
    'allowed', v_allowed,
    'current', v_count,
    'limit', v_sub.student_limit,
    'is_expired', (v_sub.current_period_ends_at < now()),
    'status', v_sub.status
  );
end;
$$;
