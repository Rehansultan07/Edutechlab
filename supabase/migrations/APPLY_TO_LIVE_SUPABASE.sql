-- =====================================================================
-- EduTechLab: Consolidated Production Database Migration
-- Execute this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/viaiolsdrikiotbqhtqp/sql/new
-- =====================================================================

-- ---------------------------------------------------------------------
-- PART 1: Schema Adjustments & Safe Extensions
-- ---------------------------------------------------------------------

-- Profiles
alter table public.profiles add column if not exists is_active boolean not null default true;

-- Students
alter table public.students add column if not exists father_name text;
alter table public.students add column if not exists mother_name text;
alter table public.students add column if not exists guardian_name text;
alter table public.students add column if not exists guardian_phone text;
alter table public.students add column if not exists aadhaar_number text;
alter table public.students add column if not exists photo_url text;
alter table public.students add column if not exists aadhaar_document_url text;
alter table public.students add column if not exists birth_certificate_url text;
alter table public.students add column if not exists address text;

-- Organizations
alter table public.organizations add column if not exists is_active boolean not null default true;
alter table public.organizations add column if not exists status text not null default 'active' check (status in ('active', 'suspended', 'pending', 'deactivated'));
alter table public.organizations add column if not exists plan text not null default 'standard';

-- Organization Settings
alter table public.organization_settings add column if not exists website text;
alter table public.organization_settings add column if not exists contact_person text;
alter table public.organization_settings add column if not exists timezone text not null default 'Asia/Kolkata';
alter table public.organization_settings add column if not exists currency text not null default 'INR';
alter table public.organization_settings add column if not exists primary_color text not null default '#171625';
alter table public.organization_settings add column if not exists secondary_color text not null default '#6657e8';
alter table public.organization_settings add column if not exists marksheet_style text not null default 'classic';
alter table public.organization_settings add column if not exists marksheet_title text not null default 'Statement of Marks';
alter table public.organization_settings add column if not exists receipt_footer text;
alter table public.organization_settings add column if not exists authorized_signatory text;
alter table public.organization_settings add column if not exists grading_scale jsonb;

-- Exam Marks
alter table public.exam_marks add column if not exists pass_percentage numeric(5,2) not null default 30;
alter table public.exam_marks add column if not exists status text not null default 'marked' check(status in ('marked','absent','fail','pass'));

-- Fee Payments Idempotency Index
alter table public.fee_payments add column if not exists idempotency_key text;
create unique index if not exists fee_payments_org_idempotency_idx
  on public.fee_payments(organization_id, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------
-- PART 2: Tables & RLS Policies
-- ---------------------------------------------------------------------

-- Student Fee Plans
create table if not exists public.student_fee_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  monthly_amount numeric(12,2) not null check(monthly_amount >= 0),
  applied_from date not null default current_date,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Student Fee Months Ledger
create table if not exists public.student_fee_months (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_plan_id uuid references public.student_fee_plans(id) on delete set null,
  academic_session_id uuid references public.academic_sessions(id) on delete set null,
  month_number int not null check(month_number between 1 and 12),
  year int not null check(year >= 2020),
  due_amount numeric(12,2) not null check(due_amount >= 0),
  paid_amount numeric(12,2) not null default 0 check(paid_amount >= 0),
  status text not null default 'unpaid' check(status in ('unpaid', 'partial', 'paid', 'waived')),
  created_at timestamptz not null default now(),
  unique(organization_id, student_id, year, month_number)
);

-- Exam Subjects
create table if not exists public.exam_subjects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject text not null,
  max_marks numeric(7,2) not null default 100,
  pass_marks numeric(7,2) not null default 33,
  created_at timestamptz not null default now(),
  unique(exam_id, subject)
);

-- Staff Permissions
create table if not exists public.staff_permissions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  enabled boolean not null default true,
  primary key(organization_id, staff_id, permission_id)
);

-- Platform Admins
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'super_admin' check (role in ('super_admin', 'support')),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.student_fee_plans enable row level security;
alter table public.student_fee_months enable row level security;
alter table public.exam_subjects enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.platform_admins enable row level security;

-- Tenant Isolation Policies
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'fee_plans same org' and tablename = 'student_fee_plans') then
    create policy "fee_plans same org" on public.student_fee_plans for all using(organization_id=public.user_org_id()) with check(organization_id=public.user_org_id());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'fee_months same org' and tablename = 'student_fee_months') then
    create policy "fee_months same org" on public.student_fee_months for all using(organization_id=public.user_org_id()) with check(organization_id=public.user_org_id());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'exam_subjects same org' and tablename = 'exam_subjects') then
    create policy "exam_subjects same org" on public.exam_subjects for all using(organization_id=public.user_org_id()) with check(organization_id=public.user_org_id());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'staff_permissions same org' and tablename = 'staff_permissions') then
    create policy "staff_permissions same org" on public.staff_permissions for all using(organization_id=public.user_org_id()) with check(organization_id=public.user_org_id());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'platform admins view self or peers' and tablename = 'platform_admins') then
    create policy "platform admins view self or peers" on public.platform_admins for select to authenticated using (user_id = auth.uid() or exists(select 1 from public.platform_admins where user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'platform admins manage organizations' and tablename = 'organizations') then
    create policy "platform admins manage organizations" on public.organizations for all to authenticated using (exists(select 1 from public.platform_admins where user_id = auth.uid())) with check (exists(select 1 from public.platform_admins where user_id = auth.uid()));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- PART 3: Stored Procedures & Atomic Business Logic (RPCs)
-- ---------------------------------------------------------------------

-- Helper to check if current caller is a verified platform admin
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.platform_admins
    where user_id = auth.uid()
  );
$$;

-- 1. Atomic Fee Payment Recording
drop function if exists public.record_fee_payment(uuid, numeric, text, text, text, date, uuid[], text);
drop function if exists public.record_fee_payment(uuid, numeric, text, text, text, date, uuid[]);
drop function if exists public.record_fee_payment;
create or replace function public.record_fee_payment(
  p_student_id uuid,
  p_amount numeric,
  p_method text default 'cash',
  p_reference text default null,
  p_note text default null,
  p_paid_on date default current_date,
  p_month_ids uuid[] default null,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_existing_id uuid;
  v_payment_id uuid;
  v_mid uuid;
  v_remaining numeric := p_amount;
  v_due numeric;
  v_paid numeric;
  v_to_apply numeric;
begin
  select organization_id into v_org_id
  from public.students
  where id = p_student_id;

  if v_org_id is null then
    raise exception 'Student not found or invalid organization.';
  end if;

  if v_org_id != public.user_org_id() then
    raise exception 'Unauthorized: cross-tenant payment operation denied.';
  end if;

  -- Idempotency check
  if p_idempotency_key is not null and trim(p_idempotency_key) != '' then
    select id into v_existing_id
    from public.fee_payments
    where organization_id = v_org_id
      and idempotency_key = trim(p_idempotency_key);

    if v_existing_id is not null then
      return jsonb_build_object(
        'payment_id', v_existing_id,
        'status', 'idempotent_duplicate',
        'message', 'Payment already processed with this transaction token.'
      );
    end if;
  end if;

  -- Insert payment
  insert into public.fee_payments (
    organization_id, student_id, amount, paid_on, method, reference, note, idempotency_key
  ) values (
    v_org_id, p_student_id, p_amount, coalesce(p_paid_on, current_date),
    coalesce(p_method, 'cash'), p_reference, p_note, nullif(trim(p_idempotency_key), '')
  ) returning id into v_payment_id;

  -- Ledger distribution
  if p_month_ids is not null and array_length(p_month_ids, 1) > 0 and v_remaining > 0 then
    foreach v_mid in array p_month_ids loop
      exit when v_remaining <= 0;

      select due_amount, paid_amount into v_due, v_paid
      from public.student_fee_months
      where id = v_mid and organization_id = v_org_id
      for update;

      if found then
        v_to_apply := least(v_remaining, greatest(v_due - v_paid, 0));
        if v_to_apply > 0 then
          update public.student_fee_months
          set
            paid_amount = paid_amount + v_to_apply,
            status = case
              when (paid_amount + v_to_apply) >= due_amount then 'paid'
              else 'partial'
            end
          where id = v_mid;

          v_remaining := v_remaining - v_to_apply;
        end if;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'status', 'success',
    'applied_amount', p_amount - v_remaining,
    'unapplied_credit', v_remaining
  );
end;
$$;

-- 2. Atomic Fee Payment Reversal / Cancellation
drop function if exists public.reverse_fee_payment(uuid);
drop function if exists public.reverse_fee_payment;
create or replace function public.reverse_fee_payment(
  p_payment_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_student_id uuid;
  v_amount numeric;
  v_remaining numeric;
  v_row record;
  v_deduct numeric;
begin
  select organization_id, student_id, amount
  into v_org_id, v_student_id, v_amount
  from public.fee_payments
  where id = p_payment_id;

  if v_org_id is null then
    raise exception 'Payment transaction not found.';
  end if;

  if v_org_id != public.user_org_id() then
    raise exception 'Unauthorized: cross-tenant operation denied.';
  end if;

  v_remaining := v_amount;

  for v_row in
    select id, due_amount, paid_amount
    from public.student_fee_months
    where student_id = v_student_id and organization_id = v_org_id and paid_amount > 0
    order by year desc, month_number desc
    for update
  loop
    exit when v_remaining <= 0;

    v_deduct := least(v_remaining, v_row.paid_amount);
    update public.student_fee_months
    set
      paid_amount = paid_amount - v_deduct,
      status = case
        when (paid_amount - v_deduct) <= 0 then 'unpaid'
        when (paid_amount - v_deduct) < due_amount then 'partial'
        else 'paid'
      end
    where id = v_row.id;

    v_remaining := v_remaining - v_deduct;
  end loop;

  delete from public.fee_payments where id = p_payment_id;
  return true;
end;
$$;

-- 3. Set Staff Permissions
drop function if exists public.set_staff_permissions(uuid, uuid[]);
drop function if exists public.set_staff_permissions;
create or replace function public.set_staff_permissions(
  p_staff_id uuid,
  p_permission_ids uuid[]
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_org uuid;
  v_caller_role text;
  v_perm_id uuid;
begin
  select organization_id, role into v_caller_org, v_caller_role
  from public.profiles where id = auth.uid();

  if v_caller_org is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Only administrators can update staff permissions.';
  end if;

  delete from public.staff_permissions
  where organization_id = v_caller_org and staff_id = p_staff_id;

  if p_permission_ids is not null and array_length(p_permission_ids, 1) > 0 then
    foreach v_perm_id in array p_permission_ids loop
      insert into public.staff_permissions (organization_id, staff_id, permission_id, enabled)
      values (v_caller_org, p_staff_id, v_perm_id, true)
      on conflict (organization_id, staff_id, permission_id)
      do update set enabled = true;
    end loop;
  end if;

  return true;
end;
$$;

-- 4. Platform Overview Stats (Super Admin Only)
drop function if exists public.get_platform_overview();
drop function if exists public.get_platform_overview;
create or replace function public.get_platform_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_super boolean;
  v_result jsonb;
begin
  select public.is_platform_admin() into v_is_super;
  if not v_is_super then
    raise exception 'Unauthorized: Only platform super administrators can access platform metrics.';
  end if;

  select jsonb_build_object(
    'total_institutions', (select count(*) from public.organizations),
    'active_institutions', (select count(*) from public.organizations where is_active = true and status = 'active'),
    'suspended_institutions', (select count(*) from public.organizations where is_active = false or status = 'suspended'),
    'total_students', (select count(*) from public.students),
    'total_teachers', (select count(*) from public.teachers),
    'total_fee_volume', coalesce((select sum(amount) from public.fee_payments), 0)
  ) into v_result;

  return v_result;
end;
$$;

-- 5. List Institutions for Platform (Super Admin Only)
drop function if exists public.list_institutions_for_platform();
drop function if exists public.list_institutions_for_platform;
create or replace function public.list_institutions_for_platform()
returns table (
  id uuid,
  name text,
  slug text,
  is_active boolean,
  status text,
  plan text,
  created_at timestamptz,
  student_count bigint,
  teacher_count bigint,
  owner_name text,
  owner_login_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_super boolean;
begin
  select public.is_platform_admin() into v_is_super;
  if not v_is_super then
    raise exception 'Unauthorized: Access restricted to platform super administrators.';
  end if;

  return query
  select
    o.id,
    o.name,
    o.slug,
    o.is_active,
    o.status,
    o.plan,
    o.created_at,
    coalesce(stu.cnt, 0)::bigint as student_count,
    coalesce(tch.cnt, 0)::bigint as teacher_count,
    p.full_name as owner_name,
    p.login_id as owner_login_id
  from public.organizations o
  left join (
    select organization_id, count(*) as cnt
    from public.students
    group by organization_id
  ) stu on stu.organization_id = o.id
  left join (
    select organization_id, count(*) as cnt
    from public.teachers
    group by organization_id
  ) tch on tch.organization_id = o.id
  left join lateral (
    select full_name, login_id
    from public.profiles
    where organization_id = o.id and role in ('owner', 'admin')
    order by created_at asc
    limit 1
  ) p on true
  order by o.created_at desc;
end;
$$;

-- 6. Update Institution Lifecycle (Super Admin Only)
drop function if exists public.update_institution_lifecycle(uuid, text, boolean);
drop function if exists public.update_institution_lifecycle;
create or replace function public.update_institution_lifecycle(
  p_org_id uuid,
  p_status text,
  p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_super boolean;
begin
  select public.is_platform_admin() into v_is_super;
  if not v_is_super then
    raise exception 'Unauthorized: Only platform super administrators can change institution lifecycle status.';
  end if;

  if p_status not in ('active', 'suspended', 'pending', 'deactivated') then
    raise exception 'Invalid status value: %', p_status;
  end if;

  update public.organizations
  set
    status = p_status,
    is_active = p_is_active
  where id = p_org_id;

  return true;
end;
$$;

-- 7. Parent Portal Lookup RPC
drop function if exists public.get_student_parent_portal(text, text);
drop function if exists public.get_student_parent_portal;
create or replace function public.get_student_parent_portal(
  p_admission_no text,
  p_phone_or_dob text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_org record;
  v_class_name text;
  v_section_name text;
  v_attendance jsonb;
  v_attendance_stats jsonb;
  v_payments jsonb;
  v_marks jsonb;
  v_notices jsonb;
  v_total_paid numeric;
  v_total_due numeric;
  v_clean_phone text;
  v_clean_adm text;
begin
  v_clean_adm := trim(p_admission_no);
  v_clean_phone := trim(p_phone_or_dob);

  if v_clean_adm = '' or v_clean_phone = '' then
    return jsonb_build_object('success', false, 'error', 'Admission number and verification credential are required.');
  end if;

  -- Verify student by admission number and (phone / guardian_phone / date_of_birth)
  select s.* into v_student
  from public.students s
  where lower(s.admission_no) = lower(v_clean_adm)
    and (
      replace(coalesce(s.phone, ''), ' ', '') = replace(v_clean_phone, ' ', '')
      or replace(coalesce(s.guardian_phone, ''), ' ', '') = replace(v_clean_phone, ' ', '')
      or s.date_of_birth::text = v_clean_phone
      or exists (
        select 1 from public.student_parents sp
        join public.parents p on p.id = sp.parent_id
        where sp.student_id = s.id
          and replace(coalesce(p.phone, ''), ' ', '') = replace(v_clean_phone, ' ', '')
      )
    )
  limit 1;

  if v_student.id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'No matching student record found. Please verify the Admission No. and registered phone number or Date of Birth.'
    );
  end if;

  -- Organization info
  select o.id, o.name, s.logo_url, s.phone, s.email, s.currency
  into v_org
  from public.organizations o
  left join public.organization_settings s on s.organization_id = o.id
  where o.id = v_student.organization_id;

  -- Class & Section names
  select name into v_class_name from public.classes where id = v_student.class_id;
  select name into v_section_name from public.sections where id = v_student.section_id;

  -- Attendance (Last 60 records)
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', attendance_date,
    'status', status,
    'note', note
  ) order by attendance_date desc), '[]'::jsonb)
  into v_attendance
  from (
    select attendance_date, status, note
    from public.attendance
    where student_id = v_student.id
    order by attendance_date desc
    limit 60
  ) att;

  -- Attendance summary
  select jsonb_build_object(
    'total_marked', count(*),
    'present', count(*) filter (where status = 'present'),
    'absent', count(*) filter (where status = 'absent'),
    'late', count(*) filter (where status = 'late'),
    'percentage', case when count(*) > 0 then round((count(*) filter (where status = 'present')::numeric / count(*)::numeric) * 100, 1) else 0 end
  )
  into v_attendance_stats
  from public.attendance
  where student_id = v_student.id;

  -- Fee Payments & Receipts
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'amount', amount,
    'paid_on', paid_on,
    'method', method,
    'reference', reference
  ) order by paid_on desc), '[]'::jsonb),
  coalesce(sum(amount), 0)
  into v_payments, v_total_paid
  from public.fee_payments
  where student_id = v_student.id;

  -- Fee dues from student_fee_months
  select coalesce(sum(due_amount), 0)
  into v_total_due
  from public.student_fee_months
  where student_id = v_student.id;

  -- Exam Marks & Results
  select coalesce(jsonb_agg(jsonb_build_object(
    'exam_name', e.name,
    'exam_date', e.exam_date,
    'subject', em.subject,
    'marks', em.marks,
    'max_marks', em.max_marks,
    'status', coalesce(em.status, 'marked')
  ) order by e.created_at desc, em.subject asc), '[]'::jsonb)
  into v_marks
  from public.exam_marks em
  join public.exams e on e.id = em.exam_id
  where em.student_id = v_student.id;

  -- Organization Notices (Recent 10)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'title', title,
    'body', body,
    'published_at', published_at
  ) order by published_at desc), '[]'::jsonb)
  into v_notices
  from (
    select id, title, body, published_at
    from public.notices
    where organization_id = v_student.organization_id
    order by published_at desc
    limit 10
  ) n;

  return jsonb_build_object(
    'success', true,
    'student', jsonb_build_object(
      'id', v_student.id,
      'admission_no', v_student.admission_no,
      'first_name', v_student.first_name,
      'last_name', v_student.last_name,
      'status', v_student.status,
      'class_name', coalesce(v_class_name, 'Not Assigned'),
      'section_name', coalesce(v_section_name, '—'),
      'photo_url', v_student.photo_url,
      'gender', v_student.gender,
      'date_of_birth', v_student.date_of_birth,
      'father_name', v_student.father_name,
      'mother_name', v_student.mother_name,
      'guardian_name', v_student.guardian_name
    ),
    'institute', jsonb_build_object(
      'name', v_org.name,
      'logo_url', v_org.logo_url,
      'phone', v_org.phone,
      'email', v_org.email,
      'currency', coalesce(v_org.currency, 'INR')
    ),
    'attendance', v_attendance,
    'attendance_stats', v_attendance_stats,
    'fees', jsonb_build_object(
      'total_paid', v_total_paid,
      'total_due', v_total_due,
      'balance', greatest(v_total_due - v_total_paid, 0),
      'payments', v_payments
    ),
    'exam_marks', v_marks,
    'notices', v_notices
  );
end;
$$;
