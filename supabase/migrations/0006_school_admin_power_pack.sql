-- =====================================================================
-- Migration 0006: School Admin Power Pack
-- Adds Expenses, Student Certificates, Class Timetable, and Homework
-- =====================================================================

-- 1. School Expenses Table
create table if not exists public.school_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  category text not null default 'other',
  amount numeric(12,2) not null check(amount > 0),
  expense_date date not null default current_date,
  payment_mode text not null default 'cash' check(payment_mode in ('cash','upi','bank_transfer','cheque','card','other')),
  paid_to text,
  voucher_no text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_school_expenses_org_date on public.school_expenses(organization_id, expense_date);

-- 2. Student Certificates Table (Transfer Certificate, Bonafide, Character)
create table if not exists public.student_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  certificate_type text not null default 'transfer_certificate' check(certificate_type in ('transfer_certificate','character_certificate','bonafide_certificate')),
  certificate_no text not null,
  issue_date date not null default current_date,
  class_name text,
  academic_year text,
  reason_for_leaving text,
  conduct text default 'Good',
  dues_cleared boolean default true,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists idx_student_certificates_org on public.student_certificates(organization_id, certificate_no);

-- 3. Class Timetables Table
create table if not exists public.class_timetables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null,
  class_name text not null,
  section_name text,
  day_of_week text not null check(day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  period_number int not null,
  start_time text,
  end_time text,
  subject text not null,
  teacher_name text,
  room_no text,
  created_at timestamptz not null default now()
);

create index if not exists idx_class_timetables_org_class on public.class_timetables(organization_id, class_name, day_of_week);

-- 4. Daily Homework & Class Diary Table
create table if not exists public.class_homework (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null,
  class_name text not null,
  section_name text,
  subject text not null,
  title text not null,
  description text not null,
  assigned_date date not null default current_date,
  due_date date,
  teacher_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_class_homework_org_date on public.class_homework(organization_id, assigned_date);

-- 5. Enable Row Level Security (RLS)
alter table public.school_expenses enable row level security;
alter table public.student_certificates enable row level security;
alter table public.class_timetables enable row level security;
alter table public.class_homework enable row level security;

-- Policies for school_expenses
create policy "Allow org members to view expenses" on public.school_expenses
  for select using (organization_id in (select organization_id from public.profiles where id = auth.uid()));

create policy "Allow org admins to manage expenses" on public.school_expenses
  for all using (organization_id in (select organization_id from public.profiles where id = auth.uid()));

-- Policies for student_certificates
create policy "Allow org members to view certificates" on public.student_certificates
  for select using (organization_id in (select organization_id from public.profiles where id = auth.uid()));

create policy "Allow org admins to manage certificates" on public.student_certificates
  for all using (organization_id in (select organization_id from public.profiles where id = auth.uid()));

-- Policies for class_timetables
create policy "Allow org members to view timetables" on public.class_timetables
  for select using (organization_id in (select organization_id from public.profiles where id = auth.uid()));

create policy "Allow org admins to manage timetables" on public.class_timetables
  for all using (organization_id in (select organization_id from public.profiles where id = auth.uid()));

-- Policies for class_homework
create policy "Allow org members to view homework" on public.class_homework
  for select using (organization_id in (select organization_id from public.profiles where id = auth.uid()));

create policy "Allow org admins to manage homework" on public.class_homework
  for all using (organization_id in (select organization_id from public.profiles where id = auth.uid()));
