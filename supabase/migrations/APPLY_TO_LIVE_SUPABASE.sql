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

      select amount_due, amount_paid into v_due, v_paid
      from public.student_fee_months
      where id = v_mid and organization_id = v_org_id
      for update;

      if found then
        v_to_apply := least(v_remaining, greatest(v_due - v_paid, 0));
        if v_to_apply > 0 then
          update public.student_fee_months
          set
            amount_paid = amount_paid + v_to_apply,
            status = case
              when (amount_paid + v_to_apply) >= amount_due then 'paid'
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
    select id, amount_due, amount_paid
    from public.student_fee_months
    where student_id = v_student_id and organization_id = v_org_id and amount_paid > 0
    order by fee_month desc
    for update
  loop
    exit when v_remaining <= 0;

    v_deduct := least(v_remaining, v_row.amount_paid);
    update public.student_fee_months
    set
      amount_paid = amount_paid - v_deduct,
      status = case
        when (amount_paid - v_deduct) <= 0 then 'unpaid'
        when (amount_paid - v_deduct) < amount_due then 'partial'
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
    select pf.full_name, pf.login_id
    from public.profiles pf
    where pf.organization_id = o.id and pf.role in ('owner', 'admin')
    order by pf.created_at asc
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
  select coalesce(sum(amount_due - amount_paid), 0)
  into v_total_due
  from public.student_fee_months
  where student_id = v_student.id and status != 'paid';

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


-- =====================================================================
-- 0011: COMPREHENSIVE STAFF PERMISSIONS & SYNC RPC
-- =====================================================================
insert into public.permissions (code, name, module) values
  ('students.view', 'View Students Directory', 'Students'),
  ('students.manage', 'Edit & Manage Students', 'Students'),
  ('admissions.manage', 'Register New Admissions', 'Admissions'),
  ('attendance.view', 'View Attendance History', 'Attendance'),
  ('attendance.manage', 'Mark & Update Attendance', 'Attendance'),
  ('fees.view', 'View Fees & Defaulters', 'Fees'),
  ('fees.manage', 'Collect Fees & Payments', 'Fees'),
  ('fees.receipts', 'Generate Fee Receipts', 'Fees'),
  ('expenses.view', 'View Expenses Log', 'Expenses'),
  ('expenses.manage', 'Record School Expenses', 'Expenses'),
  ('exams.view', 'View Exams & Datesheet', 'Exams'),
  ('exams.manage', 'Manage Exams & Schedules', 'Exams'),
  ('results.manage', 'Enter Marks & Publish Results', 'Results'),
  ('idcards.manage', 'Generate & Batch Print ID Cards', 'ID Cards'),
  ('certificates.manage', 'Issue TC & Certificates', 'Certificates'),
  ('homework.manage', 'Manage Class Homework', 'Homework'),
  ('timetable.manage', 'Manage Class Timetable', 'Timetable'),
  ('teachers.view', 'View Teachers Directory', 'Teachers'),
  ('teachers.manage', 'Add & Manage Teachers', 'Teachers'),
  ('notices.manage', 'Post School Notices', 'Notices'),
  ('reports.view', 'View Reports & Analytics', 'Reports'),
  ('staff.manage', 'Manage Staff & Roles', 'Staff'),
  ('settings.manage', 'Manage Institute Settings', 'Settings')
on conflict (code) do update set
  name = excluded.name,
  module = excluded.module;

create or replace function public.sync_system_permissions()
returns setof public.permissions
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.permissions (code, name, module) values
    ('students.view', 'View Students Directory', 'Students'),
    ('students.manage', 'Edit & Manage Students', 'Students'),
    ('admissions.manage', 'Register New Admissions', 'Admissions'),
    ('attendance.view', 'View Attendance History', 'Attendance'),
    ('attendance.manage', 'Mark & Update Attendance', 'Attendance'),
    ('fees.view', 'View Fees & Defaulters', 'Fees'),
    ('fees.manage', 'Collect Fees & Payments', 'Fees'),
    ('fees.receipts', 'Generate Fee Receipts', 'Fees'),
    ('expenses.view', 'View Expenses Log', 'Expenses'),
    ('expenses.manage', 'Record School Expenses', 'Expenses'),
    ('exams.view', 'View Exams & Datesheet', 'Exams'),
    ('exams.manage', 'Manage Exams & Schedules', 'Exams'),
    ('results.manage', 'Enter Marks & Publish Results', 'Results'),
    ('idcards.manage', 'Generate & Batch Print ID Cards', 'ID Cards'),
    ('certificates.manage', 'Issue TC & Certificates', 'Certificates'),
    ('homework.manage', 'Manage Class Homework', 'Homework'),
    ('timetable.manage', 'Manage Class Timetable', 'Timetable'),
    ('teachers.view', 'View Teachers Directory', 'Teachers'),
    ('teachers.manage', 'Add & Manage Teachers', 'Teachers'),
    ('notices.manage', 'Post School Notices', 'Notices'),
    ('reports.view', 'View Reports & Analytics', 'Reports'),
    ('staff.manage', 'Manage Staff & Roles', 'Staff'),
    ('settings.manage', 'Manage Institute Settings', 'Settings')
  on conflict (code) do update set
    name = excluded.name,
    module = excluded.module;

  return query select * from public.permissions order by module, name;
end;
$$;

grant execute on function public.sync_system_permissions() to authenticated;


-- =====================================================================
-- 0012: STUDENT PROMOTION, CLASS RESHUFFLE & SESSION ARCHIVAL
-- =====================================================================
create table if not exists public.student_academic_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  from_session_id uuid references public.academic_sessions(id) on delete set null,
  from_session_name text not null,
  to_session_id uuid references public.academic_sessions(id) on delete set null,
  to_session_name text not null,
  from_class_id uuid references public.classes(id) on delete set null,
  from_class_name text not null,
  from_section_id uuid references public.sections(id) on delete set null,
  from_section_name text,
  to_class_id uuid references public.classes(id) on delete set null,
  to_class_name text,
  to_section_id uuid references public.sections(id) on delete set null,
  to_section_name text,
  action text not null default 'promoted',
  previous_dues_carried numeric(12,2) default 0,
  promoted_at timestamptz not null default now(),
  promoted_by uuid references auth.users(id) on delete set null,
  remarks text
);

alter table public.student_academic_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'academic history same org' and tablename = 'student_academic_history') then
    create policy "academic history same org" on public.student_academic_history
      for all using (organization_id = public.user_org_id())
      with check (organization_id = public.user_org_id());
  end if;
end $$;

create index if not exists idx_student_academic_history_org 
  on public.student_academic_history(organization_id, student_id);

create or replace function public.promote_students_batch(
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_org uuid;
  v_caller_role text;
  v_item jsonb;
  v_count int := 0;
  v_student_id uuid;
  v_from_class_id uuid;
  v_from_class_name text;
  v_from_section_id uuid;
  v_from_section_name text;
  v_to_class_id uuid;
  v_to_class_name text;
  v_to_section_id uuid;
  v_to_section_name text;
  v_from_session_id uuid;
  v_from_session_name text;
  v_to_session_id uuid;
  v_to_session_name text;
  v_action text;
  v_previous_due numeric(12,2);
  v_remarks text;
begin
  select organization_id, role into v_caller_org, v_caller_role
  from public.profiles where id = auth.uid();

  if v_caller_org is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Only administrators can perform student promotions.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_student_id := (v_item->>'student_id')::uuid;
    v_from_class_id := (v_item->>'from_class_id')::uuid;
    v_from_class_name := v_item->>'from_class_name';
    v_from_section_id := nullif(v_item->>'from_section_id', '')::uuid;
    v_from_section_name := v_item->>'from_section_name';
    v_to_class_id := nullif(v_item->>'to_class_id', '')::uuid;
    v_to_class_name := v_item->>'to_class_name';
    v_to_section_id := nullif(v_item->>'to_section_id', '')::uuid;
    v_to_section_name := v_item->>'to_section_name';
    v_from_session_id := nullif(v_item->>'from_session_id', '')::uuid;
    v_from_session_name := coalesce(v_item->>'from_session_name', 'Previous Session');
    v_to_session_id := nullif(v_item->>'to_session_id', '')::uuid;
    v_to_session_name := coalesce(v_item->>'to_session_name', 'Current Session');
    v_action := coalesce(v_item->>'action', 'promoted');
    v_previous_due := coalesce((v_item->>'previous_due')::numeric, 0);
    v_remarks := v_item->>'remarks';

    insert into public.student_academic_history (
      organization_id,
      student_id,
      from_session_id,
      from_session_name,
      to_session_id,
      to_session_name,
      from_class_id,
      from_class_name,
      from_section_id,
      from_section_name,
      to_class_id,
      to_class_name,
      to_section_id,
      to_section_name,
      action,
      previous_dues_carried,
      promoted_by,
      remarks
    ) values (
      v_caller_org,
      v_student_id,
      v_from_session_id,
      v_from_session_name,
      v_to_session_id,
      v_to_session_name,
      v_from_class_id,
      v_from_class_name,
      v_from_section_id,
      v_from_section_name,
      v_to_class_id,
      v_to_class_name,
      v_to_section_id,
      v_to_section_name,
      v_action,
      v_previous_due,
      auth.uid(),
      v_remarks
    );

    if v_action = 'graduated' then
      update public.students
      set status = 'alumni'
      where id = v_student_id and organization_id = v_caller_org;
    elsif v_action = 'promoted' or v_action = 'reshuffled' then
      update public.students
      set 
        class_id = v_to_class_id,
        section_id = v_to_section_id,
        status = 'active'
      where id = v_student_id and organization_id = v_caller_org;
    elsif v_action = 'detained' then
      update public.students
      set 
        section_id = coalesce(v_to_section_id, section_id),
        status = 'active'
      where id = v_student_id and organization_id = v_caller_org;
    end if;

    if v_previous_due > 0 and (v_item->>'carry_forward_dues')::boolean = true then
      insert into public.student_fee_months (
        organization_id,
        student_id,
        fee_month,
        amount_due,
        amount_paid,
        status
      ) values (
        v_caller_org,
        v_student_id,
        date_trunc('month', current_date)::date,
        v_previous_due,
        0,
        'unpaid'
      )
      on conflict (student_id, fee_month) do update set
        amount_due = student_fee_months.amount_due + excluded.amount_due;
    end if;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('success', true, 'promoted_count', v_count);
end;
$$;

grant execute on function public.promote_students_batch(jsonb) to authenticated;

-- =====================================================================
-- Migration 0013: Attendance Auto-Save & Fast Batch Sync RPCs
-- =====================================================================

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

CREATE INDEX IF NOT EXISTS idx_attendance_org_date_status
  ON public.attendance(organization_id, attendance_date, status);

-- =====================================================================
-- Migration 0014: Platform Public Contact, Website Branding & Rates
-- =====================================================================

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

-- =====================================================================
-- Migration 0015: Attendance Cutoff Time, Auto-Absent & Teacher Attendance
-- =====================================================================

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS attendance_cutoff_time text DEFAULT '09:30',
  ADD COLUMN IF NOT EXISTS auto_mark_absent boolean DEFAULT true;

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
      -- Continue
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

-- =====================================================================
-- Migration 0016: Safe Cutoff Columns, Student Roll No & Schema Reload
-- =====================================================================

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS attendance_cutoff_time text DEFAULT '09:30',
  ADD COLUMN IF NOT EXISTS auto_mark_absent boolean DEFAULT true;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS roll_no text;

NOTIFY pgrst, 'reload schema';




-- =====================================================================
-- Migration 0017: Institute Pause/Resume Lifecycle & Super Admin Revenue
-- =====================================================================

-- 1. Add Pause columns to public.organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- 2. Add Pause columns to public.institution_subscriptions
ALTER TABLE public.institution_subscriptions
  ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- 3. Stored procedure: pause_institution (Super Admin Only)
CREATE OR REPLACE FUNCTION public.pause_institution(
  p_org_id uuid,
  p_reason text,
  p_pause_date timestamptz DEFAULT now(),
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
  v_org_name text;
  v_date timestamptz;
BEGIN
  v_is_super := public.is_platform_admin() OR (p_master_code = 'Edutechlab@#78692');
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can pause an institution.';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'Organization not found.';
  END IF;

  v_date := coalesce(p_pause_date, now());

  -- Update organizations
  UPDATE public.organizations
  SET
    is_paused = true,
    pause_reason = trim(p_reason),
    paused_at = v_date
  WHERE id = p_org_id;

  -- Update institution_subscriptions
  UPDATE public.institution_subscriptions
  SET
    is_paused = true,
    pause_reason = trim(p_reason),
    paused_at = v_date,
    updated_at = now()
  WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Institution "%s" has been paused successfully.', v_org_name),
    'is_paused', true,
    'pause_reason', trim(p_reason),
    'paused_at', v_date
  );
END;
$$;

-- 4. Stored procedure: resume_institution (Super Admin Only)
CREATE OR REPLACE FUNCTION public.resume_institution(
  p_org_id uuid,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
  v_org_name text;
BEGIN
  v_is_super := public.is_platform_admin() OR (p_master_code = 'Edutechlab@#78692');
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can resume an institution.';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'Organization not found.';
  END IF;

  -- Update organizations
  UPDATE public.organizations
  SET
    is_paused = false,
    pause_reason = null,
    paused_at = null
  WHERE id = p_org_id;

  -- Update institution_subscriptions
  UPDATE public.institution_subscriptions
  SET
    is_paused = false,
    pause_reason = null,
    paused_at = null,
    updated_at = now()
  WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Institution "%s" has been resumed successfully! All services are now active.', v_org_name),
    'is_paused', false
  );
END;
$$;

-- 5. Update get_institution_subscription to include pause data
CREATE OR REPLACE FUNCTION public.get_institution_subscription(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_org record;
  v_settings record;
  v_student_count bigint;
  v_last_payment record;
  v_days_remaining integer;
  v_is_expired boolean;
BEGIN
  IF p_org_id != public.user_org_id() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: cross-tenant access denied.';
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = p_org_id;
  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 'global';

  -- Auto-create trial if missing
  INSERT INTO public.institution_subscriptions (
    organization_id, plan_type, student_limit, monthly_amount, status,
    trial_ends_at, current_period_starts_at, current_period_ends_at, is_trial
  ) VALUES (
    p_org_id, 'trial', coalesce(v_settings.base_students, 20),
    coalesce(v_settings.base_price, 149.00), 'trial',
    now() + (coalesce(v_settings.default_trial_days, 15) * interval '1 day'),
    now(),
    now() + (coalesce(v_settings.default_trial_days, 15) * interval '1 day'),
    true
  ) ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_sub FROM public.institution_subscriptions WHERE organization_id = p_org_id;

  SELECT count(*) INTO v_student_count
  FROM public.students
  WHERE organization_id = p_org_id AND status = 'active';

  SELECT * INTO v_last_payment
  FROM public.subscription_payments
  WHERE organization_id = p_org_id
  ORDER BY created_at DESC
  LIMIT 1;

  v_days_remaining := greatest(0, ceil(extract(epoch from (v_sub.current_period_ends_at - now())) / 86400)::integer);
  v_is_expired := now() > v_sub.current_period_ends_at;

  RETURN jsonb_build_object(
    'id', v_sub.id,
    'organization_id', v_sub.organization_id,
    'plan_type', v_sub.plan_type,
    'status', CASE WHEN v_is_expired AND v_sub.status NOT IN ('pending_approval') THEN 'expired' ELSE v_sub.status END,
    'student_limit', v_sub.student_limit,
    'current_student_count', v_student_count,
    'monthly_amount', v_sub.monthly_amount,
    'is_trial', v_sub.is_trial,
    'trial_ends_at', v_sub.trial_ends_at,
    'current_period_starts_at', v_sub.current_period_starts_at,
    'current_period_ends_at', v_sub.current_period_ends_at,
    'days_remaining', v_days_remaining,
    'is_expired', v_is_expired,
    'is_paused', coalesce(v_sub.is_paused, v_org.is_paused, false),
    'pause_reason', coalesce(v_sub.pause_reason, v_org.pause_reason),
    'paused_at', coalesce(v_sub.paused_at, v_org.paused_at),
    'can_admit_students', (v_student_count < v_sub.student_limit AND (NOT v_is_expired OR v_sub.status = 'pending_approval') AND NOT coalesce(v_sub.is_paused, false)),
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
    'latest_payment', CASE WHEN v_last_payment.id IS NOT NULL THEN jsonb_build_object(
      'id', v_last_payment.id,
      'student_limit', v_last_payment.student_limit,
      'amount', v_last_payment.amount,
      'utr_number', v_last_payment.utr_number,
      'screenshot_url', v_last_payment.screenshot_url,
      'status', v_last_payment.status,
      'rejection_reason', v_last_payment.rejection_reason,
      'created_at', v_last_payment.created_at
    ) ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pause_institution(uuid, text, timestamptz, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.resume_institution(uuid, text) TO authenticated, anon;

-- =====================================================================
-- Migration 0018: Complete Institute Purge & Cascading Cleanup
-- =====================================================================
CREATE OR REPLACE FUNCTION public.delete_institution_permanently(
  p_org_id uuid,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
  v_org_name text;
  v_user_ids uuid[];
  v_uid uuid;
  v_deleted_payments int := 0;
  v_deleted_students int := 0;
BEGIN
  v_is_super := public.is_platform_admin() OR (p_master_code = 'Edutechlab@#78692');
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Unauthorized: Only platform super administrators can permanently delete institutions.';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'Institution with ID % not found.', p_org_id;
  END IF;

  SELECT array_agg(id) INTO v_user_ids
  FROM public.profiles
  WHERE organization_id = p_org_id;

  SELECT count(*) INTO v_deleted_payments FROM public.subscription_payments WHERE organization_id = p_org_id;
  SELECT count(*) INTO v_deleted_students FROM public.students WHERE organization_id = p_org_id;

  -- 1. Subscription & Platform Billing Records
  DELETE FROM public.subscription_payments WHERE organization_id = p_org_id;
  DELETE FROM public.institution_subscriptions WHERE organization_id = p_org_id;

  -- 2. Student Fees, Accounts & Expenses
  DELETE FROM public.fee_payments WHERE organization_id = p_org_id;
  DELETE FROM public.student_fee_months WHERE organization_id = p_org_id;
  DELETE FROM public.student_fee_plans WHERE organization_id = p_org_id;
  DELETE FROM public.school_expenses WHERE organization_id = p_org_id;

  -- 3. Examinations, Results & Academics
  DELETE FROM public.exam_marks WHERE organization_id = p_org_id;
  DELETE FROM public.exams WHERE organization_id = p_org_id;
  DELETE FROM public.student_certificates WHERE organization_id = p_org_id;
  DELETE FROM public.class_timetables WHERE organization_id = p_org_id;
  DELETE FROM public.class_homework WHERE organization_id = p_org_id;
  DELETE FROM public.notices WHERE organization_id = p_org_id;

  -- 4. Attendance Records
  DELETE FROM public.attendance WHERE organization_id = p_org_id;
  BEGIN
    DELETE FROM public.teacher_attendance WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 5. Staff, Teachers & Permissions
  DELETE FROM public.staff_permissions WHERE organization_id = p_org_id;
  BEGIN
    DELETE FROM public.role_permissions WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    DELETE FROM public.staff_invites WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  DELETE FROM public.teachers WHERE organization_id = p_org_id;

  -- 6. Students & Parents
  DELETE FROM public.students WHERE organization_id = p_org_id;
  BEGIN
    DELETE FROM public.parents WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 7. Academic Structure
  DELETE FROM public.sections WHERE organization_id = p_org_id;
  DELETE FROM public.classes WHERE organization_id = p_org_id;
  DELETE FROM public.academic_sessions WHERE organization_id = p_org_id;

  -- 8. Organization Settings
  DELETE FROM public.organization_settings WHERE organization_id = p_org_id;

  -- 9. User Profiles
  DELETE FROM public.profiles WHERE organization_id = p_org_id;

  -- 10. The Organization itself
  DELETE FROM public.organizations WHERE id = p_org_id;

  -- 11. Auth Users
  IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
    FOREACH v_uid IN ARRAY v_user_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_uid) THEN
        BEGIN
          DELETE FROM auth.users WHERE id = v_uid;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Institution "%s" and all related records (%s payments, %s students, fees, attendance, staff) have been permanently wiped.', v_org_name, v_deleted_payments, v_deleted_students),
    'deleted_organization_id', p_org_id,
    'deleted_payments_count', v_deleted_payments,
    'deleted_students_count', v_deleted_students
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_institution_permanently(uuid, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.delete_institution_permanently(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.delete_institution_permanently(p_org_id, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_institution_permanently(uuid) TO authenticated, anon;

-- =====================================================================
-- Migration 0019: Watertight Platform Security, Quota Enforcers & Triggers
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_institution_paused(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paused boolean := false;
  v_feat jsonb;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT coalesce(is_paused, false), enabled_features
  INTO v_paused, v_feat
  FROM public.organizations
  WHERE id = p_org_id;

  IF v_paused THEN
    RETURN true;
  END IF;

  IF v_feat IS NOT NULL AND (v_feat->>'_is_paused')::boolean = true THEN
    RETURN true;
  END IF;

  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_institution_paused(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.enforce_student_admission_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_count bigint;
BEGIN
  IF public.is_institution_paused(NEW.organization_id) THEN
    RAISE EXCEPTION 'Action Blocked: This institution is currently paused by platform administrator.';
  END IF;

  SELECT * INTO v_sub
  FROM public.institution_subscriptions
  WHERE organization_id = NEW.organization_id;

  IF v_sub.id IS NOT NULL THEN
    IF v_sub.current_period_ends_at < now() AND v_sub.status NOT IN ('pending_approval') THEN
      RAISE EXCEPTION 'Action Blocked: Institute subscription has expired (valid until %). Please renew subscription to admit students.', v_sub.current_period_ends_at::date;
    END IF;

    SELECT count(*) INTO v_count
    FROM public.students
    WHERE organization_id = NEW.organization_id AND status = 'active';

    IF v_count >= v_sub.student_limit THEN
      RAISE EXCEPTION 'Action Blocked: Student quota limit of % reached (% active students). Please upgrade your subscription plan.', v_sub.student_limit, v_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_student_admission_guard ON public.students;
CREATE TRIGGER trg_enforce_student_admission_guard
  BEFORE INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_student_admission_guard();

CREATE OR REPLACE FUNCTION public.enforce_institution_pause_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_institution_paused(NEW.organization_id) THEN
    RAISE EXCEPTION 'Action Blocked: This institution is currently paused by platform administrator.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_attendance_pause_guard ON public.attendance;
CREATE TRIGGER trg_enforce_attendance_pause_guard
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_institution_pause_guard();

DROP TRIGGER IF EXISTS trg_enforce_fees_pause_guard ON public.fee_payments;
CREATE TRIGGER trg_enforce_fees_pause_guard
  BEFORE INSERT OR UPDATE ON public.fee_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_institution_pause_guard();

DROP TRIGGER IF EXISTS trg_enforce_expenses_pause_guard ON public.school_expenses;
CREATE TRIGGER trg_enforce_expenses_pause_guard
  BEFORE INSERT OR UPDATE ON public.school_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_institution_pause_guard();

NOTIFY pgrst, 'reload schema';
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

-- =====================================================================
-- Migration 0021: Sales Agents, Variable Commissions, Joining Fee (50%),
-- Recurring Monthly Commissions, Payout Ledger & Dedicated Agent Portal
-- EduTechLab SaaS Platform
-- =====================================================================

-- 1. Sales Agents Table
CREATE TABLE IF NOT EXISTS public.sales_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  agent_code text NOT NULL UNIQUE,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  joining_commission_percent numeric(5,2) NOT NULL DEFAULT 50.00
    CHECK (joining_commission_percent >= 0 AND joining_commission_percent <= 100),
  recurring_commission_percent numeric(5,2) NOT NULL DEFAULT 20.00
    CHECK (recurring_commission_percent >= 0 AND recurring_commission_percent <= 100),
  upi_id text,
  bank_details text,
  city text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_agents_code ON public.sales_agents (upper(agent_code));
CREATE INDEX IF NOT EXISTS idx_sales_agents_email ON public.sales_agents (lower(email));

-- 2. Sales Agent Sessions Table (for Dedicated Agent Login Portal)
CREATE TABLE IF NOT EXISTS public.sales_agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.sales_agents(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_agent_sessions_token ON public.sales_agent_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_sales_agent_sessions_agent ON public.sales_agent_sessions (agent_id);

-- 3. Add Referral Attribution Columns to Organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS referred_by_agent_id uuid REFERENCES public.sales_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at timestamptz,
  ADD COLUMN IF NOT EXISTS referral_code_used text;

CREATE INDEX IF NOT EXISTS idx_organizations_referred_agent ON public.organizations (referred_by_agent_id);

-- 4. Add Payment Category & Joining Fee Breakdown Columns to Subscription Payments
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS payment_category text NOT NULL DEFAULT 'recurring',
  ADD COLUMN IF NOT EXISTS joining_fee_portion numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_subscription_payments_category'
  ) THEN
    ALTER TABLE public.subscription_payments
      ADD CONSTRAINT chk_subscription_payments_category
      CHECK (payment_category IN ('joining_fee', 'recurring', 'combined'));
  END IF;
END $$;

-- 5. Agent Commissions Ledger Table
-- Preserves permanent accounting history even if 7-day payment screenshots are cleaned up
CREATE TABLE IF NOT EXISTS public.agent_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.sales_agents(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  organization_name text NOT NULL,
  source_payment_id uuid REFERENCES public.subscription_payments(id) ON DELETE SET NULL,
  commission_type text NOT NULL CHECK (commission_type IN ('joining_fee', 'recurring', 'bonus_adjustment')),
  gross_payment_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_percent numeric(5,2) NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL,
  reference_utr text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_commissions_payment_type
  ON public.agent_commissions (source_payment_id, commission_type)
  WHERE source_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent ON public.agent_commissions (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_org ON public.agent_commissions (organization_id);

-- 6. Agent Payouts Table (Records payments settled by Super Admin to Agents)
CREATE TABLE IF NOT EXISTS public.agent_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.sales_agents(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'upi',
  reference_no text,
  paid_for_month text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_payouts_agent ON public.agent_payouts (agent_id, paid_at DESC);

-- 7. Row Level Security (Strict Lockout - All Reads/Writes via Verified SECURITY DEFINER RPCs)
ALTER TABLE public.sales_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_payouts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admins_manage_sales_agents' AND tablename = 'sales_agents') THEN
    CREATE POLICY "super_admins_manage_sales_agents" ON public.sales_agents
      FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admins_manage_agent_sessions' AND tablename = 'sales_agent_sessions') THEN
    CREATE POLICY "super_admins_manage_agent_sessions" ON public.sales_agent_sessions
      FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admins_manage_agent_commissions' AND tablename = 'agent_commissions') THEN
    CREATE POLICY "super_admins_manage_agent_commissions" ON public.agent_commissions
      FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admins_manage_agent_payouts' AND tablename = 'agent_payouts') THEN
    CREATE POLICY "super_admins_manage_agent_payouts" ON public.agent_payouts
      FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
  END IF;
END $$;

-- 8. Password Hash & Super Admin Auth Helpers
CREATE OR REPLACE FUNCTION public._hash_agent_password(p_salt text, p_password text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(sha256((coalesce(p_salt, '') || ':' || coalesce(p_password, ''))::bytea), 'hex');
$$;

CREATE OR REPLACE FUNCTION public._verify_super_admin(p_master_code text DEFAULT null)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.is_platform_admin() OR coalesce(trim(p_master_code), '') = 'Edutechlab@#78692';
END;
$$;

-- 9. Public Referral Code Verification (Safe Read-Only Preview for /register)
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
  v_agent record;
BEGIN
  v_clean := upper(trim(coalesce(p_code, '')));
  IF v_clean = '' THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  SELECT id, agent_code, full_name, is_active
  INTO v_agent
  FROM public.sales_agents
  WHERE upper(agent_code) = v_clean;

  IF v_agent.id IS NULL OR NOT v_agent.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or inactive partner referral code.');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'agent_code', v_agent.agent_code,
    'agent_name', v_agent.full_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO authenticated, anon;

-- 10. Attach Referral Code to Newly Registered Institute
CREATE OR REPLACE FUNCTION public.attach_referral_to_institute(
  p_login_id text,
  p_referral_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_code text;
  v_clean_login text;
  v_agent record;
  v_org_id uuid;
BEGIN
  v_clean_code := upper(trim(coalesce(p_referral_code, '')));
  v_clean_login := upper(trim(coalesce(p_login_id, '')));

  IF v_clean_code = '' OR v_clean_login = '' THEN
    RETURN jsonb_build_object('attached', false);
  END IF;

  SELECT id, agent_code, full_name, is_active
  INTO v_agent
  FROM public.sales_agents
  WHERE upper(agent_code) = v_clean_code;

  IF v_agent.id IS NULL OR NOT v_agent.is_active THEN
    RETURN jsonb_build_object('attached', false, 'error', 'Referral code is invalid or inactive.');
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE upper(login_id) = v_clean_login
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('attached', false, 'error', 'Institution profile not found.');
  END IF;

  UPDATE public.organizations
  SET
    referred_by_agent_id = v_agent.id,
    referred_at = coalesce(referred_at, now()),
    referral_code_used = v_agent.agent_code
  WHERE id = v_org_id
    AND referred_by_agent_id IS NULL;

  RETURN jsonb_build_object(
    'attached', true,
    'organization_id', v_org_id,
    'agent_code', v_agent.agent_code,
    'agent_name', v_agent.full_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_referral_to_institute(text, text) TO authenticated, anon;

-- 11. Enhanced Submit Subscription Payment (Supports Joining Fee vs Monthly Recurring vs Combined)
DROP FUNCTION IF EXISTS public.submit_subscription_payment(uuid, integer, numeric, text, text);
DROP FUNCTION IF EXISTS public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text);

CREATE OR REPLACE FUNCTION public.submit_subscription_payment(
  p_org_id uuid,
  p_student_limit integer,
  p_amount numeric,
  p_utr_number text,
  p_screenshot_url text DEFAULT null,
  p_payment_category text DEFAULT 'recurring',
  p_joining_fee_portion numeric DEFAULT 0,
  p_notes text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_utr text;
  v_cat text;
  v_joining numeric;
  v_payment_id uuid;
BEGIN
  IF p_org_id != public.user_org_id() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  v_clean_utr := trim(coalesce(p_utr_number, ''));
  IF v_clean_utr = '' THEN
    RAISE EXCEPTION 'UTR / Transaction Reference number is required.';
  END IF;

  IF p_student_limit < 1 THEN
    RAISE EXCEPTION 'Student limit must be at least 1.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.';
  END IF;

  v_cat := lower(trim(coalesce(p_payment_category, 'recurring')));
  IF v_cat NOT IN ('joining_fee', 'recurring', 'combined') THEN
    v_cat := 'recurring';
  END IF;

  v_joining := greatest(0, least(p_amount, coalesce(p_joining_fee_portion, 0)));
  IF v_cat = 'joining_fee' THEN
    v_joining := p_amount;
  ELSIF v_cat = 'recurring' THEN
    v_joining := 0;
  END IF;

  INSERT INTO public.subscription_payments (
    organization_id, requested_by, student_limit, amount, utr_number, screenshot_url,
    status, payment_category, joining_fee_portion, notes
  ) VALUES (
    p_org_id, auth.uid(), p_student_limit, p_amount, v_clean_utr, p_screenshot_url,
    'pending', v_cat, v_joining, nullif(trim(coalesce(p_notes, '')), '')
  ) RETURNING id INTO v_payment_id;

  UPDATE public.institution_subscriptions
  SET
    status = 'pending_approval',
    updated_at = now()
  WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'payment_category', v_cat,
    'message', 'Payment proof submitted successfully. Super Admin will verify and activate your subscription.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text) TO authenticated;

-- 12. Internal Helper: Credit Agent Commission for an Approved Payment (Idempotent)
CREATE OR REPLACE FUNCTION public._credit_agent_commission_for_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay record;
  v_org record;
  v_agent record;
  v_cat text;
  v_join_gross numeric(12,2) := 0;
  v_rec_gross numeric(12,2) := 0;
  v_join_comm numeric(12,2) := 0;
  v_rec_comm numeric(12,2) := 0;
  v_total_credited numeric(12,2) := 0;
BEGIN
  SELECT * INTO v_pay FROM public.subscription_payments WHERE id = p_payment_id;
  IF v_pay.id IS NULL OR v_pay.status <> 'approved' THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Payment not approved.');
  END IF;

  SELECT id, name, referred_by_agent_id INTO v_org
  FROM public.organizations
  WHERE id = v_pay.organization_id;

  IF v_org.id IS NULL OR v_org.referred_by_agent_id IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'No sales agent linked to this school.');
  END IF;

  SELECT * INTO v_agent FROM public.sales_agents WHERE id = v_org.referred_by_agent_id;
  IF v_agent.id IS NULL OR NOT v_agent.is_active THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Linked agent is inactive.');
  END IF;

  v_cat := coalesce(v_pay.payment_category, 'recurring');

  IF v_cat = 'joining_fee' THEN
    v_join_gross := v_pay.amount;
    v_rec_gross := 0;
  ELSIF v_cat = 'combined' THEN
    v_join_gross := greatest(0, least(v_pay.amount, coalesce(v_pay.joining_fee_portion, 0)));
    v_rec_gross := greatest(0, v_pay.amount - v_join_gross);
  ELSE
    v_join_gross := 0;
    v_rec_gross := v_pay.amount;
  END IF;

  -- Credit One-Time Joining Fee Commission (default 50% or agent custom rate)
  IF v_join_gross > 0 AND v_agent.joining_commission_percent > 0 THEN
    v_join_comm := round((v_join_gross * v_agent.joining_commission_percent) / 100.0, 2);
    IF v_join_comm > 0 THEN
      INSERT INTO public.agent_commissions (
        agent_id, organization_id, organization_name, source_payment_id,
        commission_type, gross_payment_amount, commission_percent, commission_amount,
        reference_utr, notes
      ) VALUES (
        v_agent.id, v_org.id, v_org.name, v_pay.id,
        'joining_fee', v_join_gross, v_agent.joining_commission_percent, v_join_comm,
        v_pay.utr_number, 'One-time joining/setup fee commission'
      )
      ON CONFLICT (source_payment_id, commission_type) WHERE source_payment_id IS NOT NULL
      DO NOTHING;
      v_total_credited := v_total_credited + v_join_comm;
    END IF;
  END IF;

  -- Credit Monthly Recurring Commission (agent variable rate)
  IF v_rec_gross > 0 AND v_agent.recurring_commission_percent > 0 THEN
    v_rec_comm := round((v_rec_gross * v_agent.recurring_commission_percent) / 100.0, 2);
    IF v_rec_comm > 0 THEN
      INSERT INTO public.agent_commissions (
        agent_id, organization_id, organization_name, source_payment_id,
        commission_type, gross_payment_amount, commission_percent, commission_amount,
        reference_utr, notes
      ) VALUES (
        v_agent.id, v_org.id, v_org.name, v_pay.id,
        'recurring', v_rec_gross, v_agent.recurring_commission_percent, v_rec_comm,
        v_pay.utr_number, 'Monthly subscription recurring commission'
      )
      ON CONFLICT (source_payment_id, commission_type) WHERE source_payment_id IS NOT NULL
      DO NOTHING;
      v_total_credited := v_total_credited + v_rec_comm;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'credited', true,
    'agent_id', v_agent.id,
    'agent_name', v_agent.full_name,
    'agent_code', v_agent.agent_code,
    'joining_commission', v_join_comm,
    'recurring_commission', v_rec_comm,
    'total_commission', v_total_credited
  );
END;
$$;

-- 13. Enhanced Approve Subscription Payment (Supports master code, category split, auto-commission)
DROP FUNCTION IF EXISTS public.approve_subscription_payment(uuid, integer);
DROP FUNCTION IF EXISTS public.approve_subscription_payment(uuid, integer, text);
DROP FUNCTION IF EXISTS public.approve_subscription_payment(uuid, integer, text, text, numeric);

CREATE OR REPLACE FUNCTION public.approve_subscription_payment(
  p_payment_id uuid,
  p_duration_days integer DEFAULT 30,
  p_master_code text DEFAULT null,
  p_payment_category text DEFAULT null,
  p_joining_fee_portion numeric DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay record;
  v_curr_end timestamptz;
  v_new_end timestamptz;
  v_final_cat text;
  v_final_join numeric;
  v_monthly_amt numeric;
  v_comm_result jsonb;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform super administrators can approve subscription payments.';
  END IF;

  SELECT * INTO v_pay FROM public.subscription_payments WHERE id = p_payment_id;
  IF v_pay.id IS NULL THEN
    RAISE EXCEPTION 'Payment record not found.';
  END IF;

  v_final_cat := coalesce(nullif(lower(trim(p_payment_category)), ''), v_pay.payment_category, 'recurring');
  IF v_final_cat NOT IN ('joining_fee', 'recurring', 'combined') THEN
    v_final_cat := 'recurring';
  END IF;

  v_final_join := coalesce(p_joining_fee_portion, v_pay.joining_fee_portion, 0);
  IF v_final_cat = 'joining_fee' THEN
    v_final_join := v_pay.amount;
  ELSIF v_final_cat = 'recurring' THEN
    v_final_join := 0;
  ELSE
    v_final_join := greatest(0, least(v_pay.amount, v_final_join));
  END IF;

  UPDATE public.subscription_payments
  SET
    status = 'approved',
    payment_category = v_final_cat,
    joining_fee_portion = v_final_join,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    rejection_reason = null,
    updated_at = now()
  WHERE id = p_payment_id;

  SELECT current_period_ends_at INTO v_curr_end
  FROM public.institution_subscriptions
  WHERE organization_id = v_pay.organization_id;

  IF coalesce(p_duration_days, 30) > 0 THEN
    IF v_curr_end IS NULL OR v_curr_end < now() THEN
      v_new_end := now() + (p_duration_days * interval '1 day');
    ELSE
      v_new_end := v_curr_end + (p_duration_days * interval '1 day');
    END IF;

    v_monthly_amt := CASE
      WHEN v_final_cat = 'combined' THEN greatest(0, v_pay.amount - v_final_join)
      ELSE v_pay.amount
    END;

    UPDATE public.institution_subscriptions
    SET
      plan_type = 'standard',
      status = 'active',
      is_trial = false,
      is_paused = false,
      pause_reason = null,
      paused_at = null,
      student_limit = greatest(coalesce(v_pay.student_limit, student_limit), 1),
      monthly_amount = CASE WHEN v_monthly_amt > 0 THEN v_monthly_amt ELSE monthly_amount END,
      current_period_starts_at = now(),
      current_period_ends_at = v_new_end,
      updated_at = now()
    WHERE organization_id = v_pay.organization_id;
  ELSE
    v_new_end := v_curr_end;
    -- Revert pending_approval status if joining fee only without extending days
    UPDATE public.institution_subscriptions
    SET
      status = CASE
        WHEN current_period_ends_at < now() THEN 'expired'
        WHEN is_trial THEN 'trial'
        ELSE 'active'
      END,
      updated_at = now()
    WHERE organization_id = v_pay.organization_id
      AND status = 'pending_approval';
  END IF;

  -- Unpause organization if paused
  UPDATE public.organizations
  SET is_paused = false, pause_reason = null, paused_at = null
  WHERE id = v_pay.organization_id AND is_paused = true;

  -- Automatically credit linked sales agent commission!
  v_comm_result := public._credit_agent_commission_for_payment(p_payment_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Payment approved successfully.',
    'new_period_ends_at', v_new_end,
    'student_limit', v_pay.student_limit,
    'commission', v_comm_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_subscription_payment(uuid, integer, text, text, numeric) TO authenticated, anon;

-- 14. Fix Reject Subscription Payment to support p_master_code cleanly
DROP FUNCTION IF EXISTS public.reject_subscription_payment(uuid, text);
DROP FUNCTION IF EXISTS public.reject_subscription_payment(uuid, text, text);

CREATE OR REPLACE FUNCTION public.reject_subscription_payment(
  p_payment_id uuid,
  p_reason text,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay record;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform super administrators can reject subscription payments.';
  END IF;

  SELECT * INTO v_pay FROM public.subscription_payments WHERE id = p_payment_id;
  IF v_pay.id IS NULL THEN
    RAISE EXCEPTION 'Payment record not found.';
  END IF;

  UPDATE public.subscription_payments
  SET
    status = 'rejected',
    rejection_reason = coalesce(nullif(trim(p_reason), ''), 'Payment could not be verified. Please check UTR and re-submit.'),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_payment_id;

  UPDATE public.institution_subscriptions
  SET
    status = CASE
      WHEN current_period_ends_at < now() THEN 'expired'
      WHEN is_trial THEN 'trial'
      ELSE 'active'
    END,
    updated_at = now()
  WHERE organization_id = v_pay.organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Subscription payment request rejected.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_subscription_payment(uuid, text, text) TO authenticated, anon;

-- 15. Super Admin Direct Payment Recorder (For Cash/Direct Joining Fee or Monthly Fee collected offline)
CREATE OR REPLACE FUNCTION public.admin_record_direct_school_payment(
  p_org_id uuid,
  p_amount numeric,
  p_payment_category text DEFAULT 'joining_fee',
  p_duration_days integer DEFAULT 0,
  p_student_limit integer DEFAULT null,
  p_utr_number text DEFAULT 'DIRECT-ADMIN-ENTRY',
  p_joining_fee_portion numeric DEFAULT 0,
  p_notes text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_limit integer;
  v_cat text;
  v_joining numeric;
  v_payment_id uuid;
  v_approve_res jsonb;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.';
  END IF;

  SELECT * INTO v_sub FROM public.institution_subscriptions WHERE organization_id = p_org_id;
  v_limit := greatest(1, coalesce(p_student_limit, v_sub.student_limit, 100));

  v_cat := lower(trim(coalesce(p_payment_category, 'joining_fee')));
  IF v_cat NOT IN ('joining_fee', 'recurring', 'combined') THEN
    v_cat := 'joining_fee';
  END IF;

  v_joining := CASE
    WHEN v_cat = 'joining_fee' THEN p_amount
    WHEN v_cat = 'combined' THEN greatest(0, least(p_amount, coalesce(p_joining_fee_portion, 0)))
    ELSE 0
  END;

  INSERT INTO public.subscription_payments (
    organization_id, requested_by, student_limit, amount, payment_method, utr_number,
    status, payment_category, joining_fee_portion, notes
  ) VALUES (
    p_org_id, auth.uid(), v_limit, p_amount, 'manual_admin',
    coalesce(nullif(trim(p_utr_number), ''), 'DIRECT-' || to_char(now(), 'YYYYMMDD-HH24MI')),
    'pending', v_cat, v_joining, nullif(trim(coalesce(p_notes, '')), '')
  ) RETURNING id INTO v_payment_id;

  v_approve_res := public.approve_subscription_payment(
    v_payment_id,
    coalesce(p_duration_days, CASE WHEN v_cat = 'joining_fee' THEN 0 ELSE 30 END),
    p_master_code,
    v_cat,
    v_joining
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'approval', v_approve_res
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_record_direct_school_payment(uuid, numeric, text, integer, integer, text, numeric, text, text) TO authenticated, anon;

-- 16. Super Admin Agent Management RPCs
CREATE OR REPLACE FUNCTION public.admin_create_sales_agent(
  p_full_name text,
  p_phone text,
  p_email text,
  p_agent_code text,
  p_password text,
  p_joining_percent numeric DEFAULT 50.00,
  p_recurring_percent numeric DEFAULT 20.00,
  p_upi_id text DEFAULT null,
  p_bank_details text DEFAULT null,
  p_city text DEFAULT null,
  p_notes text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_email text;
  v_salt text;
  v_hash text;
  v_agent_id uuid;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  v_code := upper(regexp_replace(trim(coalesce(p_agent_code, '')), '[^A-Za-z0-9_-]', '', 'g'));
  IF v_code = '' OR length(v_code) < 3 THEN
    RAISE EXCEPTION 'Agent code must be at least 3 alphanumeric characters.';
  END IF;

  IF length(trim(coalesce(p_full_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Agent full name is required.';
  END IF;

  IF length(trim(coalesce(p_phone, ''))) < 6 THEN
    RAISE EXCEPTION 'Valid phone number is required.';
  END IF;

  IF length(coalesce(p_password, '')) < 6 THEN
    RAISE EXCEPTION 'Agent login password must be at least 6 characters.';
  END IF;

  IF p_joining_percent < 0 OR p_joining_percent > 100 OR p_recurring_percent < 0 OR p_recurring_percent > 100 THEN
    RAISE EXCEPTION 'Commission percentages must be between 0 and 100.';
  END IF;

  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  IF EXISTS (SELECT 1 FROM public.sales_agents WHERE upper(agent_code) = v_code) THEN
    RAISE EXCEPTION 'Agent code "%" already exists. Choose a different code.', v_code;
  END IF;

  IF v_email IS NOT NULL AND EXISTS (SELECT 1 FROM public.sales_agents WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'An agent with email "%" already exists.', v_email;
  END IF;

  v_salt := gen_random_uuid()::text;
  v_hash := public._hash_agent_password(v_salt, p_password);

  INSERT INTO public.sales_agents (
    full_name, phone, email, agent_code, password_salt, password_hash,
    joining_commission_percent, recurring_commission_percent,
    upi_id, bank_details, city, notes, is_active
  ) VALUES (
    trim(p_full_name), trim(p_phone), v_email, v_code, v_salt, v_hash,
    round(p_joining_percent, 2), round(p_recurring_percent, 2),
    nullif(trim(coalesce(p_upi_id, '')), ''),
    nullif(trim(coalesce(p_bank_details, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    true
  ) RETURNING id INTO v_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'agent_id', v_agent_id,
    'agent_code', v_code,
    'message', format('Sales Agent "%s" (%s) created successfully.', trim(p_full_name), v_code)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_sales_agent(text, text, text, text, text, numeric, numeric, text, text, text, text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.admin_update_sales_agent(
  p_agent_id uuid,
  p_full_name text,
  p_phone text,
  p_email text DEFAULT null,
  p_joining_percent numeric DEFAULT 50.00,
  p_recurring_percent numeric DEFAULT 20.00,
  p_upi_id text DEFAULT null,
  p_bank_details text DEFAULT null,
  p_city text DEFAULT null,
  p_notes text DEFAULT null,
  p_is_active boolean DEFAULT true,
  p_new_password text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_salt text;
  v_hash text;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  IF p_joining_percent < 0 OR p_joining_percent > 100 OR p_recurring_percent < 0 OR p_recurring_percent > 100 THEN
    RAISE EXCEPTION 'Commission percentages must be between 0 and 100.';
  END IF;

  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sales_agents WHERE lower(email) = v_email AND id <> p_agent_id
  ) THEN
    RAISE EXCEPTION 'Another agent already uses email "%".', v_email;
  END IF;

  IF p_new_password IS NOT NULL AND trim(p_new_password) <> '' THEN
    IF length(trim(p_new_password)) < 6 THEN
      RAISE EXCEPTION 'New password must be at least 6 characters.';
    END IF;
    v_salt := gen_random_uuid()::text;
    v_hash := public._hash_agent_password(v_salt, trim(p_new_password));

    UPDATE public.sales_agents
    SET
      full_name = trim(p_full_name),
      phone = trim(p_phone),
      email = v_email,
      joining_commission_percent = round(p_joining_percent, 2),
      recurring_commission_percent = round(p_recurring_percent, 2),
      upi_id = nullif(trim(coalesce(p_upi_id, '')), ''),
      bank_details = nullif(trim(coalesce(p_bank_details, '')), ''),
      city = nullif(trim(coalesce(p_city, '')), ''),
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      is_active = coalesce(p_is_active, true),
      password_salt = v_salt,
      password_hash = v_hash,
      updated_at = now()
    WHERE id = p_agent_id;
  ELSE
    UPDATE public.sales_agents
    SET
      full_name = trim(p_full_name),
      phone = trim(p_phone),
      email = v_email,
      joining_commission_percent = round(p_joining_percent, 2),
      recurring_commission_percent = round(p_recurring_percent, 2),
      upi_id = nullif(trim(coalesce(p_upi_id, '')), ''),
      bank_details = nullif(trim(coalesce(p_bank_details, '')), ''),
      city = nullif(trim(coalesce(p_city, '')), ''),
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      is_active = coalesce(p_is_active, true),
      updated_at = now()
    WHERE id = p_agent_id;
  END IF;

  IF NOT coalesce(p_is_active, true) THEN
    DELETE FROM public.sales_agent_sessions WHERE agent_id = p_agent_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Agent profile and commission rules updated.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_sales_agent(uuid, text, text, text, numeric, numeric, text, text, text, text, boolean, text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.admin_delete_sales_agent(
  p_agent_id uuid,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  UPDATE public.organizations
  SET referred_by_agent_id = NULL
  WHERE referred_by_agent_id = p_agent_id;

  DELETE FROM public.sales_agents WHERE id = p_agent_id;

  RETURN jsonb_build_object('success', true, 'message', 'Sales agent permanently removed.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_sales_agent(uuid, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.admin_assign_agent_to_institution(
  p_org_id uuid,
  p_agent_id uuid DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := NULL;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  IF p_agent_id IS NOT NULL THEN
    SELECT agent_code INTO v_code FROM public.sales_agents WHERE id = p_agent_id;
    IF v_code IS NULL THEN
      RAISE EXCEPTION 'Selected sales agent not found.';
    END IF;
  END IF;

  UPDATE public.organizations
  SET
    referred_by_agent_id = p_agent_id,
    referred_at = CASE WHEN p_agent_id IS NOT NULL THEN coalesce(referred_at, now()) ELSE NULL END,
    referral_code_used = v_code
  WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'referred_by_agent_id', p_agent_id,
    'referral_code_used', v_code,
    'message', CASE WHEN p_agent_id IS NOT NULL THEN 'School linked to sales agent successfully.' ELSE 'School unlinked from sales agent.' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_agent_to_institution(uuid, uuid, text) TO authenticated, anon;

-- 17. Super Admin Record Payout to Agent
CREATE OR REPLACE FUNCTION public.admin_record_agent_payout(
  p_agent_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'upi',
  p_reference_no text DEFAULT null,
  p_paid_for_month text DEFAULT null,
  p_notes text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout_id uuid;
  v_earned numeric := 0;
  v_paid numeric := 0;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payout amount must be greater than zero.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sales_agents WHERE id = p_agent_id) THEN
    RAISE EXCEPTION 'Agent not found.';
  END IF;

  INSERT INTO public.agent_payouts (
    agent_id, amount, payment_method, reference_no, paid_for_month, notes
  ) VALUES (
    p_agent_id, round(p_amount, 2), coalesce(nullif(trim(p_payment_method), ''), 'upi'),
    nullif(trim(coalesce(p_reference_no, '')), ''),
    nullif(trim(coalesce(p_paid_for_month, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  ) RETURNING id INTO v_payout_id;

  SELECT coalesce(sum(commission_amount), 0) INTO v_earned FROM public.agent_commissions WHERE agent_id = p_agent_id;
  SELECT coalesce(sum(amount), 0) INTO v_paid FROM public.agent_payouts WHERE agent_id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'total_earned', v_earned,
    'total_paid', v_paid,
    'pending_balance', v_earned - v_paid,
    'message', format('Payout of ₹%s recorded successfully.', round(p_amount, 2))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_record_agent_payout(uuid, numeric, text, text, text, text, text) TO authenticated, anon;

-- 18. Super Admin Manual Commission Adjustment / Bonus
CREATE OR REPLACE FUNCTION public.admin_add_manual_commission(
  p_agent_id uuid,
  p_org_id uuid DEFAULT null,
  p_commission_type text DEFAULT 'bonus_adjustment',
  p_gross_amount numeric DEFAULT 0,
  p_commission_percent numeric DEFAULT 0,
  p_commission_amount numeric DEFAULT 0,
  p_notes text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name text := 'Platform Adjustment / Bonus';
  v_type text;
  v_comm_id uuid;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  IF p_commission_amount IS NULL OR p_commission_amount = 0 THEN
    RAISE EXCEPTION 'Commission amount cannot be zero.';
  END IF;

  v_type := lower(trim(coalesce(p_commission_type, 'bonus_adjustment')));
  IF v_type NOT IN ('joining_fee', 'recurring', 'bonus_adjustment') THEN
    v_type := 'bonus_adjustment';
  END IF;

  IF p_org_id IS NOT NULL THEN
    SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
    v_org_name := coalesce(v_org_name, 'Selected Institution');
  END IF;

  INSERT INTO public.agent_commissions (
    agent_id, organization_id, organization_name, source_payment_id,
    commission_type, gross_payment_amount, commission_percent, commission_amount,
    reference_utr, notes
  ) VALUES (
    p_agent_id, p_org_id, v_org_name, NULL,
    v_type, coalesce(p_gross_amount, 0), coalesce(p_commission_percent, 0), round(p_commission_amount, 2),
    'MANUAL-ADMIN', nullif(trim(coalesce(p_notes, '')), '')
  ) RETURNING id INTO v_comm_id;

  RETURN jsonb_build_object(
    'success', true,
    'commission_id', v_comm_id,
    'message', 'Manual commission entry added to agent wallet.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_manual_commission(uuid, uuid, text, numeric, numeric, numeric, text, text) TO authenticated, anon;

-- 19. Super Admin Full Agents & Payouts Dashboard RPC
CREATE OR REPLACE FUNCTION public.admin_list_sales_agents_dashboard(p_master_code text DEFAULT null)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agents jsonb;
  v_commissions jsonb;
  v_payouts jsonb;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required.';
  END IF;

  SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_agents
  FROM (
    SELECT jsonb_build_object(
      'id', a.id,
      'full_name', a.full_name,
      'phone', a.phone,
      'email', a.email,
      'agent_code', a.agent_code,
      'joining_commission_percent', a.joining_commission_percent,
      'recurring_commission_percent', a.recurring_commission_percent,
      'upi_id', a.upi_id,
      'bank_details', a.bank_details,
      'city', a.city,
      'notes', a.notes,
      'is_active', a.is_active,
      'created_at', a.created_at,
      'total_schools', coalesce(s.total_schools, 0),
      'active_paid_schools', coalesce(s.active_paid_schools, 0),
      'trial_schools', coalesce(s.trial_schools, 0),
      'total_revenue_generated', coalesce(c.gross_total, 0),
      'joining_earned', coalesce(c.joining_earned, 0),
      'recurring_earned', coalesce(c.recurring_earned, 0),
      'bonus_earned', coalesce(c.bonus_earned, 0),
      'total_earned', coalesce(c.total_earned, 0),
      'total_paid_out', coalesce(p.total_paid, 0),
      'pending_balance', coalesce(c.total_earned, 0) - coalesce(p.total_paid, 0)
    ) AS row_data,
    a.created_at
    FROM public.sales_agents a
    LEFT JOIN (
      SELECT
        o.referred_by_agent_id,
        count(*) AS total_schools,
        count(*) FILTER (
          WHERE sub.status = 'active' AND NOT coalesce(sub.is_trial, true) AND NOT coalesce(o.is_paused, false)
        ) AS active_paid_schools,
        count(*) FILTER (
          WHERE coalesce(sub.is_trial, true)
        ) AS trial_schools
      FROM public.organizations o
      LEFT JOIN public.institution_subscriptions sub ON sub.organization_id = o.id
      WHERE o.referred_by_agent_id IS NOT NULL
      GROUP BY o.referred_by_agent_id
    ) s ON s.referred_by_agent_id = a.id
    LEFT JOIN (
      SELECT
        agent_id,
        coalesce(sum(gross_payment_amount), 0) AS gross_total,
        coalesce(sum(commission_amount) FILTER (WHERE commission_type = 'joining_fee'), 0) AS joining_earned,
        coalesce(sum(commission_amount) FILTER (WHERE commission_type = 'recurring'), 0) AS recurring_earned,
        coalesce(sum(commission_amount) FILTER (WHERE commission_type = 'bonus_adjustment'), 0) AS bonus_earned,
        coalesce(sum(commission_amount), 0) AS total_earned
      FROM public.agent_commissions
      GROUP BY agent_id
    ) c ON c.agent_id = a.id
    LEFT JOIN (
      SELECT
        agent_id,
        coalesce(sum(amount), 0) AS total_paid
      FROM public.agent_payouts
      GROUP BY agent_id
    ) p ON p.agent_id = a.id
  ) subq;

  SELECT coalesce(jsonb_agg(c_row), '[]'::jsonb)
  INTO v_commissions
  FROM (
    SELECT jsonb_build_object(
      'id', ac.id,
      'agent_id', ac.agent_id,
      'agent_name', a.full_name,
      'agent_code', a.agent_code,
      'organization_id', ac.organization_id,
      'organization_name', ac.organization_name,
      'commission_type', ac.commission_type,
      'gross_payment_amount', ac.gross_payment_amount,
      'commission_percent', ac.commission_percent,
      'commission_amount', ac.commission_amount,
      'reference_utr', ac.reference_utr,
      'notes', ac.notes,
      'created_at', ac.created_at
    ) AS c_row
    FROM public.agent_commissions ac
    JOIN public.sales_agents a ON a.id = ac.agent_id
    ORDER BY ac.created_at DESC
    LIMIT 100
  ) c_sub;

  SELECT coalesce(jsonb_agg(p_row), '[]'::jsonb)
  INTO v_payouts
  FROM (
    SELECT jsonb_build_object(
      'id', ap.id,
      'agent_id', ap.agent_id,
      'agent_name', a.full_name,
      'agent_code', a.agent_code,
      'amount', ap.amount,
      'payment_method', ap.payment_method,
      'reference_no', ap.reference_no,
      'paid_for_month', ap.paid_for_month,
      'notes', ap.notes,
      'paid_at', ap.paid_at
    ) AS p_row
    FROM public.agent_payouts ap
    JOIN public.sales_agents a ON a.id = ap.agent_id
    ORDER BY ap.paid_at DESC
    LIMIT 100
  ) p_sub;

  RETURN jsonb_build_object(
    'agents', v_agents,
    'commissions', v_commissions,
    'payouts', v_payouts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_sales_agents_dashboard(text) TO authenticated, anon;

-- 20. Dedicated Agent Login Portal RPCs
CREATE OR REPLACE FUNCTION public.agent_login(
  p_identifier text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ident text;
  v_digits text;
  v_agent record;
  v_hash text;
  v_token text;
BEGIN
  v_ident := trim(coalesce(p_identifier, ''));
  v_digits := regexp_replace(v_ident, '\D', '', 'g');

  IF v_ident = '' OR coalesce(p_password, '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent Code / Email / Phone and Password are required.');
  END IF;

  SELECT * INTO v_agent
  FROM public.sales_agents
  WHERE upper(agent_code) = upper(v_ident)
     OR (email IS NOT NULL AND lower(email) = lower(v_ident))
     OR (length(v_digits) >= 8 AND regexp_replace(phone, '\D', '', 'g') = v_digits)
  LIMIT 1;

  IF v_agent.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid partner login credentials.');
  END IF;

  v_hash := public._hash_agent_password(v_agent.password_salt, p_password);
  IF v_hash <> v_agent.password_hash THEN
    RETURN jsonb_build_object('success', false, 'error', 'Incorrect password. Contact Super Admin if you need a reset.');
  END IF;

  IF NOT v_agent.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your sales partner account has been paused by EduTechLab Admin.');
  END IF;

  -- Clean expired sessions for this agent
  DELETE FROM public.sales_agent_sessions
  WHERE agent_id = v_agent.id AND expires_at < now();

  v_token := encode(sha256((gen_random_uuid()::text || ':' || clock_timestamp()::text || ':' || v_agent.id::text)::bytea), 'hex');

  INSERT INTO public.sales_agent_sessions (agent_id, session_token, expires_at)
  VALUES (v_agent.id, v_token, now() + interval '7 days');

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'agent', jsonb_build_object(
      'id', v_agent.id,
      'full_name', v_agent.full_name,
      'agent_code', v_agent.agent_code,
      'email', v_agent.email,
      'phone', v_agent.phone
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_login(text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_agent_portal_dashboard(p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_agent record;
  v_schools jsonb;
  v_commissions jsonb;
  v_payouts jsonb;
  v_total_earned numeric := 0;
  v_joining_earned numeric := 0;
  v_recurring_earned numeric := 0;
  v_bonus_earned numeric := 0;
  v_total_paid numeric := 0;
  v_total_revenue numeric := 0;
  v_settings record;
BEGIN
  IF trim(coalesce(p_session_token, '')) = '' THEN
    RETURN jsonb_build_object('authenticated', false, 'error', 'Session token missing.');
  END IF;

  SELECT * INTO v_session
  FROM public.sales_agent_sessions
  WHERE session_token = trim(p_session_token) AND expires_at > now();

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('authenticated', false, 'error', 'Session expired or invalid. Please sign in again.');
  END IF;

  SELECT * INTO v_agent FROM public.sales_agents WHERE id = v_session.agent_id;
  IF v_agent.id IS NULL OR NOT v_agent.is_active THEN
    RETURN jsonb_build_object('authenticated', false, 'error', 'Partner account is inactive.');
  END IF;

  SELECT contact_phone, whatsapp_number, contact_email, brand_name, standard_rate, pro_rate
  INTO v_settings
  FROM public.platform_settings
  WHERE id = 'global';

  SELECT
    coalesce(sum(commission_amount), 0),
    coalesce(sum(commission_amount) FILTER (WHERE commission_type = 'joining_fee'), 0),
    coalesce(sum(commission_amount) FILTER (WHERE commission_type = 'recurring'), 0),
    coalesce(sum(commission_amount) FILTER (WHERE commission_type = 'bonus_adjustment'), 0),
    coalesce(sum(gross_payment_amount), 0)
  INTO v_total_earned, v_joining_earned, v_recurring_earned, v_bonus_earned, v_total_revenue
  FROM public.agent_commissions
  WHERE agent_id = v_agent.id;

  SELECT coalesce(sum(amount), 0)
  INTO v_total_paid
  FROM public.agent_payouts
  WHERE agent_id = v_agent.id;

  SELECT coalesce(jsonb_agg(s_row), '[]'::jsonb)
  INTO v_schools
  FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'created_at', coalesce(o.referred_at, o.created_at),
      'is_paused', coalesce(o.is_paused, false),
      'is_active', coalesce(o.is_active, true),
      'student_count', coalesce(stu.cnt, 0),
      'student_limit', coalesce(sub.student_limit, 20),
      'plan_type', coalesce(sub.plan_type, 'trial'),
      'is_trial', coalesce(sub.is_trial, true),
      'sub_status', coalesce(sub.status, 'trial'),
      'monthly_amount', coalesce(sub.monthly_amount, 0),
      'valid_until', sub.current_period_ends_at,
      'total_school_paid', coalesce(sc.gross_sum, 0),
      'agent_earned_from_school', coalesce(sc.comm_sum, 0)
    ) AS s_row
    FROM public.organizations o
    LEFT JOIN public.institution_subscriptions sub ON sub.organization_id = o.id
    LEFT JOIN (
      SELECT organization_id, count(*) AS cnt
      FROM public.students
      WHERE status = 'active'
      GROUP BY organization_id
    ) stu ON stu.organization_id = o.id
    LEFT JOIN (
      SELECT organization_id, sum(gross_payment_amount) AS gross_sum, sum(commission_amount) AS comm_sum
      FROM public.agent_commissions
      WHERE agent_id = v_agent.id
      GROUP BY organization_id
    ) sc ON sc.organization_id = o.id
    WHERE o.referred_by_agent_id = v_agent.id
    ORDER BY coalesce(o.referred_at, o.created_at) DESC
  ) s_sub;

  SELECT coalesce(jsonb_agg(c_row), '[]'::jsonb)
  INTO v_commissions
  FROM (
    SELECT jsonb_build_object(
      'id', ac.id,
      'organization_name', ac.organization_name,
      'commission_type', ac.commission_type,
      'gross_payment_amount', ac.gross_payment_amount,
      'commission_percent', ac.commission_percent,
      'commission_amount', ac.commission_amount,
      'reference_utr', ac.reference_utr,
      'notes', ac.notes,
      'created_at', ac.created_at
    ) AS c_row
    FROM public.agent_commissions ac
    WHERE ac.agent_id = v_agent.id
    ORDER BY ac.created_at DESC
    LIMIT 100
  ) c_sub;

  SELECT coalesce(jsonb_agg(p_row), '[]'::jsonb)
  INTO v_payouts
  FROM (
    SELECT jsonb_build_object(
      'id', ap.id,
      'amount', ap.amount,
      'payment_method', ap.payment_method,
      'reference_no', ap.reference_no,
      'paid_for_month', ap.paid_for_month,
      'notes', ap.notes,
      'paid_at', ap.paid_at
    ) AS p_row
    FROM public.agent_payouts ap
    WHERE ap.agent_id = v_agent.id
    ORDER BY ap.paid_at DESC
    LIMIT 100
  ) p_sub;

  RETURN jsonb_build_object(
    'authenticated', true,
    'agent', jsonb_build_object(
      'id', v_agent.id,
      'full_name', v_agent.full_name,
      'agent_code', v_agent.agent_code,
      'email', v_agent.email,
      'phone', v_agent.phone,
      'city', v_agent.city,
      'joining_commission_percent', v_agent.joining_commission_percent,
      'recurring_commission_percent', v_agent.recurring_commission_percent,
      'upi_id', v_agent.upi_id,
      'bank_details', v_agent.bank_details,
      'created_at', v_agent.created_at
    ),
    'wallet', jsonb_build_object(
      'total_earned', v_total_earned,
      'joining_earned', v_joining_earned,
      'recurring_earned', v_recurring_earned,
      'bonus_earned', v_bonus_earned,
      'total_paid', v_total_paid,
      'pending_balance', v_total_earned - v_total_paid,
      'total_revenue_generated', v_total_revenue
    ),
    'schools', v_schools,
    'commissions', v_commissions,
    'payouts', v_payouts,
    'platform_contact', jsonb_build_object(
      'brand_name', coalesce(v_settings.brand_name, 'EduTechLab'),
      'contact_phone', v_settings.contact_phone,
      'whatsapp_number', v_settings.whatsapp_number,
      'contact_email', v_settings.contact_email,
      'standard_rate', coalesce(v_settings.standard_rate, 5),
      'pro_rate', coalesce(v_settings.pro_rate, 7)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_portal_dashboard(text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.agent_update_payout_details(
  p_session_token text,
  p_upi_id text DEFAULT null,
  p_bank_details text DEFAULT null,
  p_phone text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
BEGIN
  SELECT agent_id INTO v_agent_id
  FROM public.sales_agent_sessions
  WHERE session_token = trim(coalesce(p_session_token, '')) AND expires_at > now();

  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Session expired. Please log in again.';
  END IF;

  UPDATE public.sales_agents
  SET
    upi_id = nullif(trim(coalesce(p_upi_id, '')), ''),
    bank_details = nullif(trim(coalesce(p_bank_details, '')), ''),
    phone = coalesce(nullif(trim(coalesce(p_phone, '')), ''), phone),
    updated_at = now()
  WHERE id = v_agent_id;

  RETURN jsonb_build_object('success', true, 'message', 'Your payout details have been updated.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_update_payout_details(text, text, text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.agent_change_password(
  p_session_token text,
  p_old_password text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent record;
  v_agent_id uuid;
  v_new_salt text;
BEGIN
  SELECT agent_id INTO v_agent_id
  FROM public.sales_agent_sessions
  WHERE session_token = trim(coalesce(p_session_token, '')) AND expires_at > now();

  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Session expired. Please log in again.';
  END IF;

  SELECT * INTO v_agent FROM public.sales_agents WHERE id = v_agent_id;
  IF v_agent.id IS NULL THEN
    RAISE EXCEPTION 'Agent account not found.';
  END IF;

  IF public._hash_agent_password(v_agent.password_salt, p_old_password) <> v_agent.password_hash THEN
    RAISE EXCEPTION 'Current password is incorrect.';
  END IF;

  IF length(trim(coalesce(p_new_password, ''))) < 6 THEN
    RAISE EXCEPTION 'New password must be at least 6 characters long.';
  END IF;

  v_new_salt := gen_random_uuid()::text;
  UPDATE public.sales_agents
  SET
    password_salt = v_new_salt,
    password_hash = public._hash_agent_password(v_new_salt, trim(p_new_password)),
    updated_at = now()
  WHERE id = v_agent_id;

  RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_change_password(text, text, text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.agent_logout(p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sales_agent_sessions
  WHERE session_token = trim(coalesce(p_session_token, ''));
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_logout(text) TO authenticated, anon;

-- 21. Ensure delete_institution_permanently safely preserves settled agent commission accounting without FK errors
DROP FUNCTION IF EXISTS public.delete_institution_permanently(uuid);
CREATE OR REPLACE FUNCTION public.delete_institution_permanently(
  p_org_id uuid,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
  v_org_name text;
  v_user_ids uuid[];
  v_uid uuid;
  v_deleted_payments int := 0;
  v_deleted_students int := 0;
BEGIN
  v_is_super := public.is_platform_admin() OR (p_master_code = 'Edutechlab@#78692');
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Unauthorized: Only platform super administrators can permanently delete institutions.';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'Institution with ID % not found.', p_org_id;
  END IF;

  SELECT array_agg(id) INTO v_user_ids
  FROM public.profiles
  WHERE organization_id = p_org_id;

  SELECT count(*) INTO v_deleted_payments FROM public.subscription_payments WHERE organization_id = p_org_id;
  SELECT count(*) INTO v_deleted_students FROM public.students WHERE organization_id = p_org_id;

  -- Preserve historical agent commission ledger entries safely by unlinking deleted org
  BEGIN
    UPDATE public.agent_commissions
    SET
      organization_id = NULL,
      source_payment_id = NULL,
      organization_name = v_org_name || ' (Deleted)'
    WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  DELETE FROM public.subscription_payments WHERE organization_id = p_org_id;
  DELETE FROM public.institution_subscriptions WHERE organization_id = p_org_id;
  DELETE FROM public.fee_payments WHERE organization_id = p_org_id;
  DELETE FROM public.student_fee_months WHERE organization_id = p_org_id;
  DELETE FROM public.student_fee_plans WHERE organization_id = p_org_id;
  DELETE FROM public.school_expenses WHERE organization_id = p_org_id;
  DELETE FROM public.exam_marks WHERE organization_id = p_org_id;
  DELETE FROM public.exams WHERE organization_id = p_org_id;
  DELETE FROM public.student_certificates WHERE organization_id = p_org_id;
  DELETE FROM public.class_timetables WHERE organization_id = p_org_id;
  DELETE FROM public.class_homework WHERE organization_id = p_org_id;
  DELETE FROM public.notices WHERE organization_id = p_org_id;
  DELETE FROM public.attendance WHERE organization_id = p_org_id;
  BEGIN
    DELETE FROM public.teacher_attendance WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  DELETE FROM public.staff_permissions WHERE organization_id = p_org_id;
  BEGIN
    DELETE FROM public.role_permissions WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    DELETE FROM public.staff_invites WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  DELETE FROM public.teachers WHERE organization_id = p_org_id;
  DELETE FROM public.students WHERE organization_id = p_org_id;
  BEGIN
    DELETE FROM public.parents WHERE organization_id = p_org_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  DELETE FROM public.sections WHERE organization_id = p_org_id;
  DELETE FROM public.classes WHERE organization_id = p_org_id;
  DELETE FROM public.academic_sessions WHERE organization_id = p_org_id;
  DELETE FROM public.organization_settings WHERE organization_id = p_org_id;
  DELETE FROM public.profiles WHERE organization_id = p_org_id;
  DELETE FROM public.organizations WHERE id = p_org_id;

  IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
    FOREACH v_uid IN ARRAY v_user_ids LOOP
      IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_uid) THEN
        BEGIN
          DELETE FROM auth.users WHERE id = v_uid;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Institution "%s" and all related records (%s payments, %s students, fees, attendance, staff) have been permanently wiped.', v_org_name, v_deleted_payments, v_deleted_students),
    'deleted_organization_id', p_org_id,
    'deleted_payments_count', v_deleted_payments,
    'deleted_students_count', v_deleted_students
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_institution_permanently(uuid, text) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';



-- =====================================================================
-- MIGRATION 0022: COUPON CODES, DISCOUNT ENGINE & TRIAL MANAGEMENT
-- =====================================================================
-- Description:
-- 1. Super Admin Coupon Code Generation & Management (Validity, discount type, max uses, limits)
-- 2. Client-side Coupon Validation & Redemption at Subscription / Billing
-- 3. Dedicated RPCs to End / Revoke Free Trials immediately
-- =====================================================================

-- 1. PLATFORM COUPONS TABLE
CREATE TABLE IF NOT EXISTS public.platform_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed_amount')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_discount_amount numeric DEFAULT NULL,
  min_order_amount numeric DEFAULT 0,
  applicable_to text NOT NULL DEFAULT 'all' CHECK (applicable_to IN ('all', 'recurring', 'joining_fee', 'combined')),
  max_uses integer DEFAULT NULL,
  times_used integer NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure uppercase unique index on coupon code
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_coupons_code_upper ON public.platform_coupons (upper(trim(code)));

-- 2. COUPON REDEMPTIONS TABLE (Audit trail of who used what coupon)
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid REFERENCES public.platform_coupons(id) ON DELETE SET NULL,
  coupon_code text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_id uuid,
  original_amount numeric NOT NULL,
  discount_amount numeric NOT NULL,
  final_amount numeric NOT NULL,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. ADD COUPON COLUMNS TO SUBSCRIPTION PAYMENTS
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

-- 4. ENABLE RLS
ALTER TABLE public.platform_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anyone can read active coupons' AND tablename = 'platform_coupons') THEN
    CREATE POLICY "anyone can read active coupons" ON public.platform_coupons
      FOR SELECT USING (is_active = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super admins manage platform_coupons' AND tablename = 'platform_coupons') THEN
    CREATE POLICY "super admins manage platform_coupons" ON public.platform_coupons
      FOR ALL TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members view redemptions' AND tablename = 'coupon_redemptions') THEN
    CREATE POLICY "org members view redemptions" ON public.coupon_redemptions
      FOR SELECT TO authenticated
      USING (organization_id = public.user_org_id() OR public.is_platform_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super admins manage coupon_redemptions' AND tablename = 'coupon_redemptions') THEN
    CREATE POLICY "super admins manage coupon_redemptions" ON public.coupon_redemptions
      FOR ALL TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;
END $$;

-- 5. RPC: VALIDATE & APPLY COUPON CODE (Called by schools at checkout)
CREATE OR REPLACE FUNCTION public.validate_and_apply_coupon(
  p_code text,
  p_amount numeric,
  p_category text DEFAULT 'recurring',
  p_org_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_coupon record;
  v_discount numeric := 0;
  v_final numeric := 0;
  v_cat text;
BEGIN
  v_code := upper(trim(coalesce(p_code, '')));
  IF v_code = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Please enter a coupon code.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid order amount.');
  END IF;

  v_cat := lower(trim(coalesce(p_category, 'recurring')));

  SELECT * INTO v_coupon
  FROM public.platform_coupons
  WHERE upper(trim(code)) = v_code
  LIMIT 1;

  IF v_coupon.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Coupon code "' || v_code || '" is invalid.');
  END IF;

  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This coupon is no longer active.');
  END IF;

  IF v_coupon.valid_from > now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This coupon is not active yet.');
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < now() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'This coupon expired on ' || to_char(v_coupon.valid_until, 'DD Mon YYYY') || '.'
    );
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.times_used >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This coupon has reached its maximum usage limit.');
  END IF;

  IF v_coupon.applicable_to != 'all' AND v_coupon.applicable_to != v_cat THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'This coupon is only applicable to ' || v_coupon.applicable_to || ' payments.'
    );
  END IF;

  IF v_coupon.min_order_amount IS NOT NULL AND v_coupon.min_order_amount > 0 AND p_amount < v_coupon.min_order_amount THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Minimum order amount of ₹' || v_coupon.min_order_amount || ' is required to use this coupon.'
    );
  END IF;

  -- Calculate discount
  IF v_coupon.discount_type = 'percent' THEN
    v_discount := round((p_amount * v_coupon.discount_value) / 100.0, 2);
    IF v_coupon.max_discount_amount IS NOT NULL AND v_coupon.max_discount_amount > 0 THEN
      v_discount := least(v_discount, v_coupon.max_discount_amount);
    END IF;
  ELSE
    v_discount := least(p_amount, v_coupon.discount_value);
  END IF;

  v_discount := greatest(0, least(v_discount, p_amount));
  v_final := greatest(0, round(p_amount - v_discount, 2));

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'discount_amount', v_discount,
    'original_amount', p_amount,
    'final_amount', v_final,
    'valid_until', v_coupon.valid_until,
    'description', v_coupon.description,
    'message', 'Coupon ' || v_coupon.code || ' applied successfully! You saved ₹' || v_discount || '.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_and_apply_coupon(text, numeric, text, uuid) TO authenticated, anon;

-- 6. RPC: SUPER ADMIN CREATE COUPON
CREATE OR REPLACE FUNCTION public.admin_create_coupon(
  p_code text,
  p_discount_type text,
  p_discount_value numeric,
  p_valid_until timestamptz DEFAULT null,
  p_max_uses integer DEFAULT null,
  p_applicable_to text DEFAULT 'all',
  p_description text DEFAULT null,
  p_min_order_amount numeric DEFAULT 0,
  p_max_discount_amount numeric DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_coupon_id uuid;
  v_type text;
  v_cat text;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  v_code := upper(trim(coalesce(p_code, '')));
  IF v_code = '' THEN
    RAISE EXCEPTION 'Coupon code cannot be empty.';
  END IF;

  IF length(v_code) < 3 OR length(v_code) > 25 THEN
    RAISE EXCEPTION 'Coupon code must be between 3 and 25 characters.';
  END IF;

  IF p_discount_value IS NULL OR p_discount_value <= 0 THEN
    RAISE EXCEPTION 'Discount value must be greater than zero.';
  END IF;

  v_type := lower(trim(coalesce(p_discount_type, 'percent')));
  IF v_type NOT IN ('percent', 'fixed_amount') THEN
    v_type := 'percent';
  END IF;

  IF v_type = 'percent' AND p_discount_value > 100 THEN
    RAISE EXCEPTION 'Percentage discount cannot exceed 100%%.';
  END IF;

  v_cat := lower(trim(coalesce(p_applicable_to, 'all')));
  IF v_cat NOT IN ('all', 'recurring', 'joining_fee', 'combined') THEN
    v_cat := 'all';
  END IF;

  IF EXISTS (SELECT 1 FROM public.platform_coupons WHERE upper(trim(code)) = v_code) THEN
    RAISE EXCEPTION 'Coupon code "%" already exists.', v_code;
  END IF;

  INSERT INTO public.platform_coupons (
    code, description, discount_type, discount_value, max_discount_amount,
    min_order_amount, applicable_to, max_uses, valid_until, is_active, created_by
  ) VALUES (
    v_code, nullif(trim(coalesce(p_description, '')), ''),
    v_type, round(p_discount_value, 2),
    case when p_max_discount_amount > 0 then round(p_max_discount_amount, 2) else null end,
    greatest(0, coalesce(p_min_order_amount, 0)),
    v_cat,
    case when p_max_uses > 0 then p_max_uses else null end,
    p_valid_until,
    true,
    auth.uid()
  ) RETURNING id INTO v_coupon_id;

  RETURN jsonb_build_object(
    'success', true,
    'coupon_id', v_coupon_id,
    'code', v_code,
    'message', 'Coupon "' || v_code || '" created successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_coupon(text, text, numeric, timestamptz, integer, text, text, numeric, numeric, text) TO authenticated, anon;

-- 7. RPC: SUPER ADMIN UPDATE COUPON
CREATE OR REPLACE FUNCTION public.admin_update_coupon(
  p_coupon_id uuid,
  p_is_active boolean DEFAULT null,
  p_valid_until timestamptz DEFAULT null,
  p_max_uses integer DEFAULT null,
  p_description text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  UPDATE public.platform_coupons
  SET
    is_active = coalesce(p_is_active, is_active),
    valid_until = p_valid_until,
    max_uses = case when p_max_uses > 0 then p_max_uses when p_max_uses = 0 then null else max_uses end,
    description = coalesce(nullif(trim(p_description), ''), description),
    updated_at = now()
  WHERE id = p_coupon_id;

  RETURN jsonb_build_object('success', true, 'message', 'Coupon updated successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_coupon(uuid, boolean, timestamptz, integer, text, text) TO authenticated, anon;

-- 8. RPC: SUPER ADMIN DELETE COUPON
CREATE OR REPLACE FUNCTION public.admin_delete_coupon(
  p_coupon_id uuid,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  SELECT code INTO v_code FROM public.platform_coupons WHERE id = p_coupon_id;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Coupon not found.';
  END IF;

  DELETE FROM public.platform_coupons WHERE id = p_coupon_id;

  RETURN jsonb_build_object('success', true, 'message', 'Coupon "' || v_code || '" deleted.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_coupon(uuid, text) TO authenticated, anon;

-- 9. RPC: SUPER ADMIN LIST ALL COUPONS WITH STATS
CREATE OR REPLACE FUNCTION public.admin_list_coupons(p_master_code text DEFAULT null)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list jsonb;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_list
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'code', c.code,
      'description', c.description,
      'discount_type', c.discount_type,
      'discount_value', c.discount_value,
      'max_discount_amount', c.max_discount_amount,
      'min_order_amount', c.min_order_amount,
      'applicable_to', c.applicable_to,
      'max_uses', c.max_uses,
      'times_used', c.times_used,
      'valid_from', c.valid_from,
      'valid_until', c.valid_until,
      'is_active', c.is_active,
      'created_at', c.created_at,
      'is_expired', (c.valid_until IS NOT NULL AND c.valid_until < now()),
      'total_discount_given', coalesce(r.total_discount, 0),
      'redemptions_count', coalesce(r.redemptions_count, 0)
    ) AS row_data,
    c.created_at
    FROM public.platform_coupons c
    LEFT JOIN (
      SELECT
        coupon_id,
        coalesce(sum(discount_amount), 0) AS total_discount,
        count(*) AS redemptions_count
      FROM public.coupon_redemptions
      GROUP BY coupon_id
    ) r ON r.coupon_id = c.id
  ) s;

  RETURN jsonb_build_object(
    'success', true,
    'coupons', v_list
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_coupons(text) TO authenticated, anon;

-- 10. RPC: SUPER ADMIN END INSTITUTION TRIAL (Dedicated, explicit trial termination)
CREATE OR REPLACE FUNCTION public.admin_end_institution_trial(
  p_org_id uuid,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name text;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'Institution not found.';
  END IF;

  UPDATE public.institution_subscriptions
  SET
    is_trial = false,
    status = 'expired',
    current_period_ends_at = now() - interval '1 second',
    trial_ends_at = now() - interval '1 second',
    updated_at = now()
  WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Free trial for "' || v_org_name || '" has been ended. The school must now purchase a subscription.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_end_institution_trial(uuid, text) TO authenticated, anon;

-- 11. ENHANCED SUBMIT SUBSCRIPTION PAYMENT (Supports coupon tracking)
DROP FUNCTION IF EXISTS public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text, text, numeric, numeric);

CREATE OR REPLACE FUNCTION public.submit_subscription_payment(
  p_org_id uuid,
  p_student_limit integer,
  p_amount numeric,
  p_utr_number text,
  p_screenshot_url text DEFAULT null,
  p_payment_category text DEFAULT 'recurring',
  p_joining_fee_portion numeric DEFAULT 0,
  p_notes text DEFAULT null,
  p_coupon_code text DEFAULT null,
  p_discount_amount numeric DEFAULT 0,
  p_original_amount numeric DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_utr text;
  v_cat text;
  v_joining numeric;
  v_payment_id uuid;
  v_coupon record;
  v_code text;
  v_orig numeric;
  v_disc numeric;
BEGIN
  IF p_org_id != public.user_org_id() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  v_clean_utr := trim(coalesce(p_utr_number, ''));
  IF v_clean_utr = '' THEN
    RAISE EXCEPTION 'UTR / Transaction Reference number is required.';
  END IF;

  IF p_student_limit < 1 THEN
    RAISE EXCEPTION 'Student limit must be at least 1.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.';
  END IF;

  v_cat := lower(trim(coalesce(p_payment_category, 'recurring')));
  IF v_cat NOT IN ('joining_fee', 'recurring', 'combined') THEN
    v_cat := 'recurring';
  END IF;

  v_joining := greatest(0, least(p_amount, coalesce(p_joining_fee_portion, 0)));
  IF v_cat = 'joining_fee' THEN
    v_joining := p_amount;
  ELSIF v_cat = 'recurring' THEN
    v_joining := 0;
  END IF;

  v_code := upper(trim(coalesce(p_coupon_code, '')));
  v_disc := greatest(0, coalesce(p_discount_amount, 0));
  v_orig := coalesce(p_original_amount, p_amount + v_disc);

  INSERT INTO public.subscription_payments (
    organization_id, requested_by, student_limit, amount, utr_number, screenshot_url,
    status, payment_category, joining_fee_portion, notes,
    coupon_code, original_amount, discount_amount
  ) VALUES (
    p_org_id, auth.uid(), p_student_limit, p_amount, v_clean_utr, p_screenshot_url,
    'pending', v_cat, v_joining, nullif(trim(coalesce(p_notes, '')), ''),
    nullif(v_code, ''), v_orig, v_disc
  ) RETURNING id INTO v_payment_id;

  -- If coupon was used, record redemption & increment counter
  IF v_code <> '' THEN
    SELECT * INTO v_coupon FROM public.platform_coupons WHERE upper(trim(code)) = v_code LIMIT 1;
    IF v_coupon.id IS NOT NULL THEN
      UPDATE public.platform_coupons
      SET times_used = times_used + 1, updated_at = now()
      WHERE id = v_coupon.id;

      INSERT INTO public.coupon_redemptions (
        coupon_id, coupon_code, organization_id, payment_id,
        original_amount, discount_amount, final_amount, redeemed_by
      ) VALUES (
        v_coupon.id, v_coupon.code, p_org_id, v_payment_id,
        v_orig, v_disc, p_amount, auth.uid()
      );
    END IF;
  END IF;

  UPDATE public.institution_subscriptions
  SET
    status = 'pending_approval',
    updated_at = now()
  WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'payment_category', v_cat,
    'coupon_applied', nullif(v_code, ''),
    'discount_amount', v_disc,
    'message', 'Payment proof submitted. Your subscription will be approved shortly.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text, text, numeric, numeric) TO authenticated;


NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- MIGRATION 0023: Add admission_date column to public.students
-- ============================================================================
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS admission_date date DEFAULT current_date;

-- Backfill any existing students where admission_date is NULL using their creation date
UPDATE public.students
SET admission_date = created_at::date
WHERE admission_date IS NULL;

-- Index for filtering and sorting students by admission date
CREATE INDEX IF NOT EXISTS idx_students_admission_date
  ON public.students (organization_id, admission_date);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';



-- =====================================================================
-- MIGRATION 0024: SCHOOL VIRTUAL WALLET & REFERRAL SYSTEM
-- =====================================================================
-- Description:
-- 1. Every School gets a unique Referral Code (e.g., SCH-XXXXXX) & shareable referral links.
-- 2. Every School gets an Institution Virtual Wallet (balance, total_earned, total_spent).
-- 3. Detailed Wallet Transactions Ledger (referral bonuses, subscription discounts, refunds).
-- 4. Unified referral verification & attribution (handles both Sales Agents & Schools).
-- 5. Automatic referral bonus reward when a referred school's subscription is approved.
-- 6. Instant Wallet Credit redemption at subscription payment / renewal checkout.
-- 7. Wallet balance refund protection if payment is rejected.
-- 8. Super Admin controls: Referral bonus configuration, wallet oversight, and manual balance adjustments.
-- =====================================================================

-- 1. ADD REFERRAL COLUMNS TO ORGANIZATIONS
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Unique case-insensitive index on school referral code
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_referral_code_upper 
  ON public.organizations (upper(trim(referral_code))) 
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_referred_by_org_id 
  ON public.organizations (referred_by_org_id);

-- 2. FUNCTION TO GENERATE UNIQUE SCHOOL REFERRAL CODE
CREATE OR REPLACE FUNCTION public.generate_school_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code text;
  v_exists boolean;
  v_loop integer := 0;
BEGIN
  LOOP
    v_loop := v_loop + 1;
    v_code := 'SCH-';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;

    -- Ensure neither organization nor sales agent shares this code
    SELECT EXISTS (
      SELECT 1 FROM public.organizations WHERE upper(trim(referral_code)) = v_code
      UNION ALL
      SELECT 1 FROM public.sales_agents WHERE upper(trim(agent_code)) = v_code
    ) INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_code;
    END IF;

    IF v_loop > 50 THEN
      -- Fallback to UUID segment
      RETURN 'SCH-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    END IF;
  END LOOP;
END;
$$;

-- Backfill referral code for any existing organization that has null
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.organizations WHERE referral_code IS NULL OR trim(referral_code) = '' LOOP
    UPDATE public.organizations
    SET referral_code = public.generate_school_referral_code()
    WHERE id = r.id;
  END LOOP;
END $$;

-- 3. TRIGGER TO AUTO-ASSIGN REFERRAL CODE TO NEW ORGANIZATIONS
CREATE OR REPLACE FUNCTION public.trg_fn_assign_school_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR trim(NEW.referral_code) = '' THEN
    NEW.referral_code := public.generate_school_referral_code();
  ELSE
    NEW.referral_code := upper(trim(NEW.referral_code));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_school_referral_code ON public.organizations;
CREATE TRIGGER trg_assign_school_referral_code
  BEFORE INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_assign_school_referral_code();

-- 4. INSTITUTION VIRTUAL WALLET TABLE
CREATE TABLE IF NOT EXISTS public.institution_wallets (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  total_earned numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_earned >= 0),
  total_spent numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_spent >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. INSTITUTION WALLET TRANSACTIONS LEDGER
CREATE TABLE IF NOT EXISTS public.institution_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL, -- positive for credit, negative for debit
  transaction_type text NOT NULL CHECK (transaction_type IN ('referral_bonus', 'subscription_discount', 'manual_adjustment', 'refund')),
  source_payment_id uuid REFERENCES public.subscription_payments(id) ON DELETE SET NULL,
  referred_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  referred_org_name text,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institution_wallet_transactions_org 
  ON public.institution_wallet_transactions (organization_id, created_at DESC);

-- Backfill wallets for existing organizations
INSERT INTO public.institution_wallets (organization_id, balance, total_earned, total_spent)
SELECT id, 0.00, 0.00, 0.00
FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;

-- Trigger to auto-create wallet on new organization creation
CREATE OR REPLACE FUNCTION public.trg_fn_create_school_wallet()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.institution_wallets (organization_id, balance, total_earned, total_spent)
  VALUES (NEW.id, 0.00, 0.00, 0.00)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_school_wallet ON public.organizations;
CREATE TRIGGER trg_create_school_wallet
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_create_school_wallet();

-- 6. ADD WALLET DISCOUNT COLUMN TO SUBSCRIPTION PAYMENTS
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS wallet_discount numeric DEFAULT 0;

-- 7. ADD REFERRAL BONUS SETTINGS TO PLATFORM SETTINGS
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS school_referral_bonus_amount numeric NOT NULL DEFAULT 500.00;

-- 8. ENABLE RLS ON WALLET TABLES
ALTER TABLE public.institution_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_wallet_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Wallets read policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members read own wallet' AND tablename = 'institution_wallets') THEN
    CREATE POLICY "org members read own wallet" ON public.institution_wallets
      FOR SELECT TO authenticated
      USING (organization_id = public.user_org_id() OR public.is_platform_admin());
  END IF;

  -- Wallets super admin full control
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super admins manage wallets' AND tablename = 'institution_wallets') THEN
    CREATE POLICY "super admins manage wallets" ON public.institution_wallets
      FOR ALL TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;

  -- Transactions read policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org members read own wallet transactions' AND tablename = 'institution_wallet_transactions') THEN
    CREATE POLICY "org members read own wallet transactions" ON public.institution_wallet_transactions
      FOR SELECT TO authenticated
      USING (organization_id = public.user_org_id() OR public.is_platform_admin());
  END IF;

  -- Transactions super admin full control
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super admins manage wallet transactions' AND tablename = 'institution_wallet_transactions') THEN
    CREATE POLICY "super admins manage wallet transactions" ON public.institution_wallet_transactions
      FOR ALL TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;
END $$;

-- 9. UNIFIED REFERRAL CODE VALIDATION (Supports Sales Agents & Schools)
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
  v_agent record;
  v_org record;
BEGIN
  v_clean := upper(trim(coalesce(p_code, '')));
  IF v_clean = '' THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  -- 1. Check Sales Agents first
  SELECT id, agent_code, full_name, is_active
  INTO v_agent
  FROM public.sales_agents
  WHERE upper(trim(agent_code)) = v_clean;

  IF v_agent.id IS NOT NULL THEN
    IF NOT v_agent.is_active THEN
      RETURN jsonb_build_object('valid', false, 'error', 'This partner referral code is currently inactive.');
    END IF;
    RETURN jsonb_build_object(
      'valid', true,
      'type', 'agent',
      'agent_code', v_agent.agent_code,
      'agent_name', v_agent.full_name
    );
  END IF;

  -- 2. Check Schools / Organizations
  SELECT id, name, referral_code, is_active, is_paused
  INTO v_org
  FROM public.organizations
  WHERE upper(trim(referral_code)) = v_clean;

  IF v_org.id IS NOT NULL THEN
    IF coalesce(v_org.is_paused, false) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'This school referral code is currently inactive.');
    END IF;
    RETURN jsonb_build_object(
      'valid', true,
      'type', 'school',
      'agent_code', v_org.referral_code,
      'agent_name', v_org.name,
      'school_name', v_org.name
    );
  END IF;

  RETURN jsonb_build_object('valid', false, 'error', 'Referral code "' || v_clean || '" not found or inactive.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO authenticated, anon;

-- 10. UNIFIED ATTACH REFERRAL CODE TO NEW INSTITUTE
CREATE OR REPLACE FUNCTION public.attach_referral_to_institute(
  p_login_id text,
  p_referral_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_code text;
  v_clean_login text;
  v_agent record;
  v_ref_org record;
  v_target_org_id uuid;
BEGIN
  v_clean_code := upper(trim(coalesce(p_referral_code, '')));
  v_clean_login := upper(trim(coalesce(p_login_id, '')));

  IF v_clean_code = '' OR v_clean_login = '' THEN
    RETURN jsonb_build_object('attached', false);
  END IF;

  SELECT organization_id INTO v_target_org_id
  FROM public.profiles
  WHERE upper(trim(login_id)) = v_clean_login
  LIMIT 1;

  IF v_target_org_id IS NULL THEN
    RETURN jsonb_build_object('attached', false, 'error', 'Institution profile not found.');
  END IF;

  -- Check Sales Agents
  SELECT id, agent_code, full_name, is_active
  INTO v_agent
  FROM public.sales_agents
  WHERE upper(trim(agent_code)) = v_clean_code;

  IF v_agent.id IS NOT NULL THEN
    IF NOT v_agent.is_active THEN
      RETURN jsonb_build_object('attached', false, 'error', 'Partner referral code is inactive.');
    END IF;

    UPDATE public.organizations
    SET
      referred_by_agent_id = v_agent.id,
      referred_at = coalesce(referred_at, now()),
      referral_code_used = v_agent.agent_code
    WHERE id = v_target_org_id
      AND referred_by_agent_id IS NULL
      AND referred_by_org_id IS NULL;

    RETURN jsonb_build_object(
      'attached', true,
      'type', 'agent',
      'organization_id', v_target_org_id,
      'agent_code', v_agent.agent_code,
      'agent_name', v_agent.full_name
    );
  END IF;

  -- Check Schools
  SELECT id, name, referral_code
  INTO v_ref_org
  FROM public.organizations
  WHERE upper(trim(referral_code)) = v_clean_code;

  IF v_ref_org.id IS NOT NULL THEN
    -- Disallow self-referral
    IF v_ref_org.id = v_target_org_id THEN
      RETURN jsonb_build_object('attached', false, 'error', 'A school cannot refer itself.');
    END IF;

    UPDATE public.organizations
    SET
      referred_by_org_id = v_ref_org.id,
      referred_at = coalesce(referred_at, now()),
      referral_code_used = v_ref_org.referral_code
    WHERE id = v_target_org_id
      AND referred_by_agent_id IS NULL
      AND referred_by_org_id IS NULL;

    RETURN jsonb_build_object(
      'attached', true,
      'type', 'school',
      'organization_id', v_target_org_id,
      'referrer_school_id', v_ref_org.id,
      'school_name', v_ref_org.name
    );
  END IF;

  RETURN jsonb_build_object('attached', false, 'error', 'Referral code not found.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_referral_to_institute(text, text) TO authenticated, anon;

-- 11. INTERNAL HELPER: CREDIT SCHOOL REFERRAL BONUS ON SUBSCRIPTION APPROVAL
CREATE OR REPLACE FUNCTION public._credit_school_referral_bonus(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay record;
  v_org record;
  v_ref_org record;
  v_bonus_amount numeric := 500.00;
  v_settings record;
  v_already_rewarded boolean;
BEGIN
  SELECT * INTO v_pay FROM public.subscription_payments WHERE id = p_payment_id;
  IF v_pay.id IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Payment not found');
  END IF;

  SELECT id, name, referred_by_org_id INTO v_org
  FROM public.organizations
  WHERE id = v_pay.organization_id;

  IF v_org.id IS NULL OR v_org.referred_by_org_id IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'No referring school linked to this institute.');
  END IF;

  -- Ensure referrer school exists
  SELECT id, name INTO v_ref_org FROM public.organizations WHERE id = v_org.referred_by_org_id;
  IF v_ref_org.id IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Referring school record not found.');
  END IF;

  -- Check if bonus was already rewarded for referring this school
  SELECT EXISTS (
    SELECT 1 FROM public.institution_wallet_transactions
    WHERE organization_id = v_org.referred_by_org_id
      AND referred_org_id = v_org.id
      AND transaction_type = 'referral_bonus'
  ) INTO v_already_rewarded;

  IF v_already_rewarded THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'Referral bonus already awarded for this school.');
  END IF;

  -- Fetch reward amount from platform_settings
  SELECT coalesce(school_referral_bonus_amount, 500.00) INTO v_bonus_amount
  FROM public.platform_settings
  WHERE id = 'global';

  IF v_bonus_amount IS NULL OR v_bonus_amount <= 0 THEN
    v_bonus_amount := 500.00;
  END IF;

  -- Credit Referrer's Virtual Wallet
  INSERT INTO public.institution_wallets (organization_id, balance, total_earned, total_spent, updated_at)
  VALUES (v_ref_org.id, v_bonus_amount, v_bonus_amount, 0.00, now())
  ON CONFLICT (organization_id) DO UPDATE
  SET balance = public.institution_wallets.balance + v_bonus_amount,
      total_earned = public.institution_wallets.total_earned + v_bonus_amount,
      updated_at = now();

  -- Record in Ledger
  INSERT INTO public.institution_wallet_transactions (
    organization_id, amount, transaction_type, source_payment_id,
    referred_org_id, referred_org_name, description
  ) VALUES (
    v_ref_org.id, v_bonus_amount, 'referral_bonus', p_payment_id,
    v_org.id, v_org.name, 'Referral reward: ' || v_org.name || ' activated their subscription!'
  );

  RETURN jsonb_build_object(
    'credited', true,
    'bonus_amount', v_bonus_amount,
    'referrer_id', v_ref_org.id,
    'referrer_name', v_ref_org.name,
    'referred_school', v_org.name
  );
END;
$$;

-- 12. ENHANCED SUBMIT SUBSCRIPTION PAYMENT WITH WALLET BALANCE REDEMPTION
DROP FUNCTION IF EXISTS public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text, text, numeric, numeric);
DROP FUNCTION IF EXISTS public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text, text, numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION public.submit_subscription_payment(
  p_org_id uuid,
  p_student_limit integer,
  p_amount numeric,
  p_utr_number text,
  p_screenshot_url text DEFAULT null,
  p_payment_category text DEFAULT 'recurring',
  p_joining_fee_portion numeric DEFAULT 0,
  p_notes text DEFAULT null,
  p_coupon_code text DEFAULT null,
  p_discount_amount numeric DEFAULT 0,
  p_original_amount numeric DEFAULT null,
  p_wallet_deduction numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_utr text;
  v_cat text;
  v_joining numeric;
  v_payment_id uuid;
  v_coupon record;
  v_code text;
  v_orig numeric;
  v_disc numeric;
  v_wallet_deduct numeric := 0;
  v_wallet record;
  v_final_payable numeric;
BEGIN
  IF p_org_id != public.user_org_id() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  v_clean_utr := trim(coalesce(p_utr_number, ''));
  IF v_clean_utr = '' THEN
    RAISE EXCEPTION 'UTR / Transaction Reference number is required.';
  END IF;

  IF p_student_limit < 1 THEN
    RAISE EXCEPTION 'Student limit must be at least 1.';
  END IF;

  v_wallet_deduct := greatest(0, round(coalesce(p_wallet_deduction, 0), 2));
  v_disc := greatest(0, round(coalesce(p_discount_amount, 0), 2));
  v_final_payable := greatest(0, round(coalesce(p_amount, 0), 2));
  v_orig := coalesce(p_original_amount, v_final_payable + v_disc + v_wallet_deduct);

  -- Ensure total transaction value is positive
  IF (v_final_payable + v_wallet_deduct) <= 0 THEN
    RAISE EXCEPTION 'Payment amount cannot be zero without valid wallet deduction.';
  END IF;

  -- Validate and deduct wallet balance if requested
  IF v_wallet_deduct > 0 THEN
    SELECT * INTO v_wallet FROM public.institution_wallets WHERE organization_id = p_org_id FOR UPDATE;
    IF v_wallet.organization_id IS NULL OR v_wallet.balance < v_wallet_deduct THEN
      RAISE EXCEPTION 'Insufficient wallet balance. Available: ₹%, Requested: ₹%', 
        coalesce(v_wallet.balance, 0), v_wallet_deduct;
    END IF;

    UPDATE public.institution_wallets
    SET balance = balance - v_wallet_deduct,
        total_spent = total_spent + v_wallet_deduct,
        updated_at = now()
    WHERE organization_id = p_org_id;
  END IF;

  v_cat := lower(trim(coalesce(p_payment_category, 'recurring')));
  IF v_cat NOT IN ('joining_fee', 'recurring', 'combined') THEN
    v_cat := 'recurring';
  END IF;

  v_joining := greatest(0, least(v_final_payable, coalesce(p_joining_fee_portion, 0)));
  IF v_cat = 'joining_fee' THEN
    v_joining := v_final_payable;
  ELSIF v_cat = 'recurring' THEN
    v_joining := 0;
  END IF;

  v_code := upper(trim(coalesce(p_coupon_code, '')));

  INSERT INTO public.subscription_payments (
    organization_id, requested_by, student_limit, amount, utr_number, screenshot_url,
    status, payment_category, joining_fee_portion, notes,
    coupon_code, original_amount, discount_amount, wallet_discount
  ) VALUES (
    p_org_id, auth.uid(), p_student_limit, v_final_payable, v_clean_utr, p_screenshot_url,
    'pending', v_cat, v_joining, nullif(trim(coalesce(p_notes, '')), ''),
    nullif(v_code, ''), v_orig, v_disc, v_wallet_deduct
  ) RETURNING id INTO v_payment_id;

  -- Log wallet deduction in transactions ledger
  IF v_wallet_deduct > 0 THEN
    INSERT INTO public.institution_wallet_transactions (
      organization_id, amount, transaction_type, source_payment_id, description
    ) VALUES (
      p_org_id, -v_wallet_deduct, 'subscription_discount', v_payment_id,
      'Redeemed ₹' || v_wallet_deduct || ' wallet credits towards subscription renewal (UTR: ' || v_clean_utr || ')'
    );
  END IF;

  -- Record coupon redemption if coupon was applied
  IF v_code <> '' THEN
    SELECT * INTO v_coupon FROM public.platform_coupons WHERE upper(trim(code)) = v_code LIMIT 1;
    IF v_coupon.id IS NOT NULL THEN
      UPDATE public.platform_coupons
      SET times_used = times_used + 1, updated_at = now()
      WHERE id = v_coupon.id;

      INSERT INTO public.coupon_redemptions (
        coupon_id, coupon_code, organization_id, payment_id,
        original_amount, discount_amount, final_amount, redeemed_by
      ) VALUES (
        v_coupon.id, v_coupon.code, p_org_id, v_payment_id,
        v_orig, v_disc, v_final_payable, auth.uid()
      );
    END IF;
  END IF;

  UPDATE public.institution_subscriptions
  SET
    status = 'pending_approval',
    updated_at = now()
  WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'payment_category', v_cat,
    'wallet_discount', v_wallet_deduct,
    'coupon_applied', nullif(v_code, ''),
    'discount_amount', v_disc,
    'net_amount_paid', v_final_payable,
    'message', 'Payment proof submitted. Your subscription will be approved shortly.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_subscription_payment(uuid, integer, numeric, text, text, text, numeric, text, text, numeric, numeric, numeric) TO authenticated;

-- 13. ENHANCED APPROVE SUBSCRIPTION PAYMENT (Auto-credits Sales Agent & School Referrer)
DROP FUNCTION IF EXISTS public.approve_subscription_payment(uuid, integer, text, text, numeric);

CREATE OR REPLACE FUNCTION public.approve_subscription_payment(
  p_payment_id uuid,
  p_duration_days integer DEFAULT 30,
  p_master_code text DEFAULT null,
  p_payment_category text DEFAULT null,
  p_joining_fee_portion numeric DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay record;
  v_curr_end timestamptz;
  v_new_end timestamptz;
  v_final_cat text;
  v_final_join numeric;
  v_monthly_amt numeric;
  v_agent_comm_result jsonb;
  v_school_referral_result jsonb;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform super administrators can approve subscription payments.';
  END IF;

  SELECT * INTO v_pay FROM public.subscription_payments WHERE id = p_payment_id;
  IF v_pay.id IS NULL THEN
    RAISE EXCEPTION 'Payment record not found.';
  END IF;

  v_final_cat := coalesce(nullif(lower(trim(p_payment_category)), ''), v_pay.payment_category, 'recurring');
  IF v_final_cat NOT IN ('joining_fee', 'recurring', 'combined') THEN
    v_final_cat := 'recurring';
  END IF;

  v_final_join := coalesce(p_joining_fee_portion, v_pay.joining_fee_portion, 0);
  IF v_final_cat = 'joining_fee' THEN
    v_final_join := v_pay.amount;
  ELSIF v_final_cat = 'recurring' THEN
    v_final_join := 0;
  ELSE
    v_final_join := greatest(0, least(v_pay.amount, v_final_join));
  END IF;

  UPDATE public.subscription_payments
  SET
    status = 'approved',
    payment_category = v_final_cat,
    joining_fee_portion = v_final_join,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    rejection_reason = null,
    updated_at = now()
  WHERE id = p_payment_id;

  SELECT current_period_ends_at INTO v_curr_end
  FROM public.institution_subscriptions
  WHERE organization_id = v_pay.organization_id;

  IF coalesce(p_duration_days, 30) > 0 THEN
    IF v_curr_end IS NULL OR v_curr_end < now() THEN
      v_new_end := now() + (p_duration_days * interval '1 day');
    ELSE
      v_new_end := v_curr_end + (p_duration_days * interval '1 day');
    END IF;

    v_monthly_amt := CASE
      WHEN v_final_cat = 'combined' THEN greatest(0, v_pay.amount - v_final_join)
      ELSE v_pay.amount
    END;

    UPDATE public.institution_subscriptions
    SET
      plan_type = 'standard',
      status = 'active',
      is_trial = false,
      is_paused = false,
      pause_reason = null,
      paused_at = null,
      student_limit = greatest(coalesce(v_pay.student_limit, student_limit), 1),
      monthly_amount = CASE WHEN v_monthly_amt > 0 THEN v_monthly_amt ELSE monthly_amount END,
      current_period_starts_at = now(),
      current_period_ends_at = v_new_end,
      updated_at = now()
    WHERE organization_id = v_pay.organization_id;
  ELSE
    v_new_end := v_curr_end;
    UPDATE public.institution_subscriptions
    SET
      status = CASE
        WHEN current_period_ends_at < now() THEN 'expired'
        WHEN is_trial THEN 'trial'
        ELSE 'active'
      END,
      updated_at = now()
    WHERE organization_id = v_pay.organization_id
      AND status = 'pending_approval';
  END IF;

  -- Unpause organization if paused
  UPDATE public.organizations
  SET is_paused = false, pause_reason = null, paused_at = null
  WHERE id = v_pay.organization_id AND is_paused = true;

  -- 1. Auto credit linked sales agent commission
  v_agent_comm_result := public._credit_agent_commission_for_payment(p_payment_id);

  -- 2. Auto credit referring school referral bonus in virtual wallet!
  v_school_referral_result := public._credit_school_referral_bonus(p_payment_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Payment approved successfully.',
    'new_period_ends_at', v_new_end,
    'student_limit', v_pay.student_limit,
    'agent_commission', v_agent_comm_result,
    'school_referral', v_school_referral_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_subscription_payment(uuid, integer, text, text, numeric) TO authenticated, anon;

-- 14. ENHANCED REJECT SUBSCRIPTION PAYMENT (With Wallet Balance Refund Protection)
DROP FUNCTION IF EXISTS public.reject_subscription_payment(uuid, text, text);

CREATE OR REPLACE FUNCTION public.reject_subscription_payment(
  p_payment_id uuid,
  p_reason text,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay record;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform super administrators can reject subscription payments.';
  END IF;

  SELECT * INTO v_pay FROM public.subscription_payments WHERE id = p_payment_id;
  IF v_pay.id IS NULL THEN
    RAISE EXCEPTION 'Payment record not found.';
  END IF;

  UPDATE public.subscription_payments
  SET
    status = 'rejected',
    rejection_reason = coalesce(nullif(trim(p_reason), ''), 'Payment could not be verified. Please check UTR and re-submit.'),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_payment_id;

  -- Refund wallet discount back to school wallet if any was used
  IF coalesce(v_pay.wallet_discount, 0) > 0 THEN
    UPDATE public.institution_wallets
    SET balance = balance + v_pay.wallet_discount,
        total_spent = greatest(0, total_spent - v_pay.wallet_discount),
        updated_at = now()
    WHERE organization_id = v_pay.organization_id;

    INSERT INTO public.institution_wallet_transactions (
      organization_id, amount, transaction_type, source_payment_id, description
    ) VALUES (
      v_pay.organization_id, v_pay.wallet_discount, 'refund', p_payment_id,
      'Refund of ₹' || v_pay.wallet_discount || ' wallet credits due to rejected payment (' || coalesce(nullif(trim(p_reason), ''), 'rejected') || ')'
    );
  END IF;

  UPDATE public.institution_subscriptions
  SET
    status = CASE
      WHEN current_period_ends_at < now() THEN 'expired'
      WHEN is_trial THEN 'trial'
      ELSE 'active'
    END,
    updated_at = now()
  WHERE organization_id = v_pay.organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Subscription payment request rejected and wallet balance refunded if used.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_subscription_payment(uuid, text, text) TO authenticated, anon;

-- 15. RPC: GET SCHOOL REFERRAL & WALLET OVERVIEW (For School Dashboard & Subscription Page)
CREATE OR REPLACE FUNCTION public.get_school_referral_and_wallet_data(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org record;
  v_wallet record;
  v_bonus_rate numeric := 500.00;
  v_referred_schools jsonb;
  v_transactions jsonb;
BEGIN
  IF p_org_id != public.user_org_id() AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  SELECT id, name, referral_code, created_at INTO v_org
  FROM public.organizations
  WHERE id = p_org_id;

  IF v_org.id IS NULL THEN
    RAISE EXCEPTION 'Organization not found.';
  END IF;

  -- Ensure wallet row exists
  INSERT INTO public.institution_wallets (organization_id, balance, total_earned, total_spent)
  VALUES (p_org_id, 0.00, 0.00, 0.00)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.institution_wallets WHERE organization_id = p_org_id;

  -- Referral bonus amount setting
  SELECT coalesce(school_referral_bonus_amount, 500.00) INTO v_bonus_rate
  FROM public.platform_settings
  WHERE id = 'global';

  -- List of referred schools
  SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_referred_schools
  FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'created_at', o.created_at,
      'status', coalesce(s.status, 'trial'),
      'is_trial', coalesce(s.is_trial, true),
      'bonus_earned', coalesce(t.bonus_amount, 0),
      'is_rewarded', (t.bonus_amount IS NOT NULL AND t.bonus_amount > 0)
    ) AS row_data,
    o.created_at
    FROM public.organizations o
    LEFT JOIN public.institution_subscriptions s ON s.organization_id = o.id
    LEFT JOIN (
      SELECT referred_org_id, sum(amount) AS bonus_amount
      FROM public.institution_wallet_transactions
      WHERE organization_id = p_org_id AND transaction_type = 'referral_bonus'
      GROUP BY referred_org_id
    ) t ON t.referred_org_id = o.id
    WHERE o.referred_by_org_id = p_org_id
  ) s;

  -- Recent wallet transactions ledger
  SELECT coalesce(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_transactions
  FROM (
    SELECT jsonb_build_object(
      'id', id,
      'amount', amount,
      'transaction_type', transaction_type,
      'referred_org_name', referred_org_name,
      'description', description,
      'created_at', created_at
    ) AS row_data,
    created_at
    FROM public.institution_wallet_transactions
    WHERE organization_id = p_org_id
    LIMIT 50
  ) tx;

  RETURN jsonb_build_object(
    'organization_id', v_org.id,
    'school_name', v_org.name,
    'referral_code', v_org.referral_code,
    'bonus_rate_per_school', v_bonus_rate,
    'wallet', jsonb_build_object(
      'balance', coalesce(v_wallet.balance, 0),
      'total_earned', coalesce(v_wallet.total_earned, 0),
      'total_spent', coalesce(v_wallet.total_spent, 0),
      'updated_at', v_wallet.updated_at
    ),
    'referred_schools_count', coalesce(jsonb_array_length(v_referred_schools), 0),
    'referred_schools', v_referred_schools,
    'transactions', v_transactions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_referral_and_wallet_data(uuid) TO authenticated;

-- 16. SUPER ADMIN RPC: LIST ALL SCHOOL WALLETS & REFERRALS
CREATE OR REPLACE FUNCTION public.admin_list_school_wallets(p_master_code text DEFAULT null)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallets jsonb;
  v_total_balance numeric;
  v_total_earned numeric;
  v_total_spent numeric;
  v_bonus_rate numeric;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  SELECT coalesce(school_referral_bonus_amount, 500.00) INTO v_bonus_rate
  FROM public.platform_settings
  WHERE id = 'global';

  SELECT
    coalesce(sum(balance), 0),
    coalesce(sum(total_earned), 0),
    coalesce(sum(total_spent), 0)
  INTO v_total_balance, v_total_earned, v_total_spent
  FROM public.institution_wallets;

  SELECT coalesce(jsonb_agg(row_data ORDER BY total_earned DESC, name ASC), '[]'::jsonb)
  INTO v_wallets
  FROM (
    SELECT jsonb_build_object(
      'organization_id', o.id,
      'name', o.name,
      'referral_code', o.referral_code,
      'created_at', o.created_at,
      'is_active', o.is_active,
      'balance', coalesce(w.balance, 0),
      'total_earned', coalesce(w.total_earned, 0),
      'total_spent', coalesce(w.total_spent, 0),
      'referred_count', coalesce(ref_counts.cnt, 0),
      'referred_by_code', o.referral_code_used
    ) AS row_data,
    coalesce(w.total_earned, 0) AS total_earned,
    o.name
    FROM public.organizations o
    LEFT JOIN public.institution_wallets w ON w.organization_id = o.id
    LEFT JOIN (
      SELECT referred_by_org_id, count(*) AS cnt
      FROM public.organizations
      WHERE referred_by_org_id IS NOT NULL
      GROUP BY referred_by_org_id
    ) ref_counts ON ref_counts.referred_by_org_id = o.id
  ) s;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_rate_per_school', v_bonus_rate,
    'stats', jsonb_build_object(
      'total_balance', v_total_balance,
      'total_earned', v_total_earned,
      'total_spent', v_total_spent,
      'total_schools', coalesce(jsonb_array_length(v_wallets), 0)
    ),
    'wallets', v_wallets
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_school_wallets(text) TO authenticated, anon;

-- 17. SUPER ADMIN RPC: MANUAL CREDIT / DEBIT ADJUSTMENT TO SCHOOL WALLET
CREATE OR REPLACE FUNCTION public.admin_adjust_school_wallet(
  p_org_id uuid,
  p_amount numeric,
  p_type text, -- 'credit' or 'debit'
  p_notes text DEFAULT null,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_amt numeric;
  v_wallet record;
  v_org_name text;
  v_tx_type text;
  v_delta numeric;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'School organization not found.';
  END IF;

  v_clean_amt := round(abs(coalesce(p_amount, 0)), 2);
  IF v_clean_amt <= 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be greater than zero.';
  END IF;

  -- Ensure wallet exists
  INSERT INTO public.institution_wallets (organization_id, balance, total_earned, total_spent)
  VALUES (p_org_id, 0.00, 0.00, 0.00)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.institution_wallets WHERE organization_id = p_org_id FOR UPDATE;

  IF lower(trim(p_type)) = 'credit' THEN
    v_delta := v_clean_amt;
    v_tx_type := 'manual_adjustment';

    UPDATE public.institution_wallets
    SET balance = balance + v_clean_amt,
        total_earned = total_earned + v_clean_amt,
        updated_at = now()
    WHERE organization_id = p_org_id;

    INSERT INTO public.institution_wallet_transactions (
      organization_id, amount, transaction_type, description, created_by
    ) VALUES (
      p_org_id, v_clean_amt, 'manual_adjustment',
      coalesce(nullif(trim(p_notes), ''), 'Manual bonus credit added by Super Admin'),
      auth.uid()
    );

  ELSIF lower(trim(p_type)) = 'debit' THEN
    IF v_wallet.balance < v_clean_amt THEN
      RAISE EXCEPTION 'Cannot debit ₹%. Available balance is only ₹%.', v_clean_amt, v_wallet.balance;
    END IF;

    v_delta := -v_clean_amt;
    v_tx_type := 'manual_adjustment';

    UPDATE public.institution_wallets
    SET balance = balance - v_clean_amt,
        total_spent = total_spent + v_clean_amt,
        updated_at = now()
    WHERE organization_id = p_org_id;

    INSERT INTO public.institution_wallet_transactions (
      organization_id, amount, transaction_type, description, created_by
    ) VALUES (
      p_org_id, -v_clean_amt, 'manual_adjustment',
      coalesce(nullif(trim(p_notes), ''), 'Manual debit adjustment by Super Admin'),
      auth.uid()
    );
  ELSE
    RAISE EXCEPTION 'Invalid adjustment type. Must be "credit" or "debit".';
  END IF;

  SELECT * INTO v_wallet FROM public.institution_wallets WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'school_name', v_org_name,
    'adjusted_amount', v_delta,
    'new_balance', v_wallet.balance,
    'message', 'Wallet for "' || v_org_name || '" updated successfully. New balance: ₹' || v_wallet.balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_school_wallet(uuid, numeric, text, text, text) TO authenticated, anon;

-- 18. SUPER ADMIN RPC: UPDATE REFERRAL BONUS AMOUNT SETTING
CREATE OR REPLACE FUNCTION public.admin_update_school_referral_reward(
  p_bonus_amount numeric,
  p_master_code text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amt numeric;
BEGIN
  IF NOT public._verify_super_admin(p_master_code) THEN
    RAISE EXCEPTION 'Unauthorized: Super admin credentials required.';
  END IF;

  v_amt := round(greatest(0, coalesce(p_bonus_amount, 0)), 2);

  UPDATE public.platform_settings
  SET school_referral_bonus_amount = v_amt,
      updated_at = now()
  WHERE id = 'global';

  RETURN jsonb_build_object(
    'success', true,
    'bonus_amount', v_amt,
    'message', 'School referral reward set to ₹' || v_amt || ' per successful school onboarding.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_school_referral_reward(numeric, text) TO authenticated, anon;

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
