-- =====================================================================
-- Migration 0003: Complete Schema Synchronization & Atomic Financial RPCs
-- EduTechLab SaaS Platform
-- =====================================================================

-- 1. Extend Profiles Table
alter table public.profiles add column if not exists is_active boolean not null default true;

-- 2. Extend Students Table
alter table public.students add column if not exists father_name text;
alter table public.students add column if not exists mother_name text;
alter table public.students add column if not exists guardian_name text;
alter table public.students add column if not exists guardian_phone text;
alter table public.students add column if not exists aadhaar_number text;
alter table public.students add column if not exists photo_url text;
alter table public.students add column if not exists aadhaar_document_url text;
alter table public.students add column if not exists birth_certificate_url text;
alter table public.students add column if not exists address text;

-- 3. Extend Organization Settings Table
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

-- 4. Fee Plans Table
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

-- 5. Fee Months Table (Monthly Ledger)
create table if not exists public.student_fee_months (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_plan_id uuid references public.student_fee_plans(id) on delete set null,
  fee_month date not null,
  amount_due numeric(12,2) not null default 0 check(amount_due >= 0),
  amount_paid numeric(12,2) not null default 0 check(amount_paid >= 0),
  status text not null default 'due' check(status in ('due','partial','paid')),
  paid_on date,
  created_at timestamptz not null default now(),
  unique(student_id, fee_month)
);

-- 6. Extend Fee Payments Table
alter table public.fee_payments add column if not exists receipt_no text;
alter table public.fee_payments add column if not exists fee_month text;
alter table public.fee_payments add column if not exists fee_month_id uuid references public.student_fee_months(id) on delete set null;
alter table public.fee_payments add column if not exists idempotency_key text;

-- Critical index for idempotency protection
create unique index if not exists fee_payments_org_idempotency_idx 
  on public.fee_payments(organization_id, idempotency_key) 
  where idempotency_key is not null;

-- 7. Exam Subjects Table
create table if not exists public.exam_subjects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject text not null,
  max_marks numeric(7,2) not null default 100,
  pass_percentage numeric(5,2) not null default 30,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(exam_id, subject)
);

-- 8. Extend Exam Marks Table
alter table public.exam_marks add column if not exists pass_percentage numeric(5,2) not null default 30;
alter table public.exam_marks add column if not exists status text not null default 'marked' check(status in ('marked','absent','fail','pass'));

-- 9. Staff Permissions Table
create table if not exists public.staff_permissions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  enabled boolean not null default true,
  primary key(organization_id, staff_id, permission_id)
);

-- Enable RLS
alter table public.student_fee_plans enable row level security;
alter table public.student_fee_months enable row level security;
alter table public.exam_subjects enable row level security;
alter table public.staff_permissions enable row level security;

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
end $$;

-- 10. RPC: set_staff_permissions
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
  v_staff_org uuid;
  v_perm_id uuid;
begin
  select organization_id, role into v_caller_org, v_caller_role
  from public.profiles where id = auth.uid();

  if v_caller_org is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Only administrators can update staff permissions.';
  end if;

  select organization_id into v_staff_org
  from public.profiles where id = p_staff_id;

  if v_staff_org is null or v_staff_org <> v_caller_org then
    raise exception 'Target staff member does not belong to your organization.';
  end if;

  delete from public.staff_permissions
  where organization_id = v_caller_org and staff_id = p_staff_id;

  if p_permission_ids is not null and array_length(p_permission_ids, 1) > 0 then
    foreach v_perm_id in array p_permission_ids loop
      insert into public.staff_permissions(organization_id, staff_id, permission_id, enabled)
      values (v_caller_org, p_staff_id, v_perm_id, true)
      on conflict do nothing;
    end loop;
  end if;

  return true;
end;
$$;

-- 11. RPC: record_fee_payment (Atomic & Idempotent)
create or replace function public.record_fee_payment(
  p_organization_id uuid,
  p_student_id uuid,
  p_fee_month_id uuid,
  p_amount numeric,
  p_paid_on date,
  p_method text,
  p_reference text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_org uuid;
  v_month record;
  v_existing record;
  v_payment_id uuid;
  v_receipt_no text;
  v_new_paid numeric;
  v_new_status text;
  v_count int;
begin
  select organization_id into v_caller_org
  from public.profiles where id = auth.uid();

  if v_caller_org is null or v_caller_org <> p_organization_id then
    raise exception 'Unauthorized: organization mismatch.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  -- Idempotency check: if already processed with this key, return safely without duplicate
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select id, receipt_no, amount, paid_on into v_existing
    from public.fee_payments
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key
    limit 1;

    if v_existing.id is not null then
      return jsonb_build_object(
        'success', true,
        'payment_id', v_existing.id,
        'receipt_no', v_existing.receipt_no,
        'amount', v_existing.amount,
        'idempotent_replay', true
      );
    end if;
  end if;

  -- Lock month record for update
  select id, amount_due, amount_paid, fee_month into v_month
  from public.student_fee_months
  where id = p_fee_month_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Fee month record not found.';
  end if;

  if p_amount > (v_month.amount_due - v_month.amount_paid) then
    raise exception 'Payment amount exceeds outstanding balance.';
  end if;

  -- Generate sequential receipt number
  select count(*) + 1 into v_count
  from public.fee_payments
  where organization_id = p_organization_id;

  v_receipt_no := 'REC-' || to_char(coalesce(p_paid_on, current_date), 'YYYYMM') || '-' || lpad(v_count::text, 4, '0');

  -- Insert payment record
  insert into public.fee_payments(
    organization_id, student_id, amount, paid_on, method, reference, receipt_no, fee_month, fee_month_id, idempotency_key
  ) values (
    p_organization_id, p_student_id, p_amount, coalesce(p_paid_on, current_date), coalesce(p_method, 'cash'), p_reference, v_receipt_no, to_char(v_month.fee_month, 'YYYY-MM-DD'), p_fee_month_id, p_idempotency_key
  ) returning id into v_payment_id;

  -- Update month record
  v_new_paid := v_month.amount_paid + p_amount;
  v_new_status := case when v_new_paid >= v_month.amount_due then 'paid' else 'partial' end;

  update public.student_fee_months
  set amount_paid = v_new_paid,
      status = v_new_status,
      paid_on = coalesce(p_paid_on, current_date)
  where id = p_fee_month_id;

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'receipt_no', v_receipt_no,
    'amount', p_amount,
    'idempotent_replay', false
  );
end;
$$;

-- 12. RPC: reverse_fee_payment (Atomic & Safe Deletion)
create or replace function public.reverse_fee_payment(
  p_payment_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_org uuid;
  v_caller_role text;
  v_pay record;
  v_month record;
  v_new_paid numeric;
  v_new_status text;
begin
  select organization_id, role into v_caller_org, v_caller_role
  from public.profiles where id = auth.uid();

  if v_caller_org is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Unauthorized: Only Owner or Admin can reverse payments.';
  end if;

  select id, organization_id, amount, fee_month_id, paid_on into v_pay
  from public.fee_payments
  where id = p_payment_id and organization_id = v_caller_org
  for update;

  if not found then
    raise exception 'Payment record not found.';
  end if;

  if v_pay.fee_month_id is not null then
    select id, amount_due, amount_paid into v_month
    from public.student_fee_months
    where id = v_pay.fee_month_id and organization_id = v_caller_org
    for update;

    if found then
      v_new_paid := greatest(0, v_month.amount_paid - v_pay.amount);
      v_new_status := case
        when v_new_paid = 0 then 'due'
        when v_new_paid >= v_month.amount_due then 'paid'
        else 'partial'
      end;

      update public.student_fee_months
      set amount_paid = v_new_paid,
          status = v_new_status,
          paid_on = case when v_new_paid = 0 then null else paid_on end
      where id = v_pay.fee_month_id;
    end if;
  end if;

  delete from public.fee_payments where id = p_payment_id;
  return true;
end;
$$;
