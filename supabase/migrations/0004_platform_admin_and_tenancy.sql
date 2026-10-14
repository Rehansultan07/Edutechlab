-- =====================================================================
-- Migration 0004: Platform Admin (Super Admin) & Tenant Status Controls
-- EduTechLab SaaS Platform
-- =====================================================================

-- 1. Extend Organizations Table with Status and Lifecycle Flags
alter table public.organizations add column if not exists is_active boolean not null default true;
alter table public.organizations add column if not exists status text not null default 'active' check (status in ('active', 'suspended', 'pending', 'deactivated'));
alter table public.organizations add column if not exists plan text not null default 'standard';

-- 2. Platform Admins Table (Strict separation from tenant profiles)
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'super_admin' check (role in ('super_admin', 'support')),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.platform_admins enable row level security;

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

-- RLS Policies for Platform Admins table
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'platform admins view self or peers' and tablename = 'platform_admins') then
    create policy "platform admins view self or peers" on public.platform_admins
      for select to authenticated
      using (user_id = auth.uid() or public.is_platform_admin());
  end if;
end $$;

-- Allow platform admins to view and manage all organizations
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'platform admins manage organizations' and tablename = 'organizations') then
    create policy "platform admins manage organizations" on public.organizations
      for all to authenticated
      using (public.is_platform_admin())
      with check (public.is_platform_admin());
  end if;
end $$;

-- 3. Secure RPC: get_platform_overview (Super Admin Only)
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
  -- Enforce Platform Admin authorization
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

-- 4. Secure RPC: list_institutions_for_platform (Super Admin Only)
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

-- 5. Secure RPC: update_institution_lifecycle (Super Admin Only)
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
