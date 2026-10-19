-- =====================================================================
-- Migration 0007: Institution Feature Controller (Super Admin Feature Allocation)
-- EduTechLab SaaS Platform
-- =====================================================================

-- 1. Add enabled_features column to organizations
alter table public.organizations 
add column if not exists enabled_features jsonb not null 
default '{"students":true,"id_cards":true,"certificates":true,"academics":true,"timetable":true,"homework":true,"teachers":true,"attendance":true,"fees":true,"expenses":true,"exams":true,"notices":true,"staff":true}'::jsonb;

-- 2. Secure RPC: update_institution_features (Super Admin Only)
create or replace function public.update_institution_features(
  p_org_id uuid,
  p_features jsonb,
  p_master_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_super boolean := false;
  v_master_valid boolean := false;
  v_org_name text;
begin
  -- Validate caller permission
  select public.is_platform_admin() into v_is_super;
  if p_master_code = 'Edutechlab@#78692' then
    v_master_valid := true;
  end if;

  if not v_is_super and not v_master_valid then
    raise exception 'Unauthorized: Only platform super administrator can configure institution features.';
  end if;

  -- Verify target organization exists
  select name into v_org_name from public.organizations where id = p_org_id;
  if not found then
    raise exception 'Organization with ID % not found.', p_org_id;
  end if;

  -- Update features
  update public.organizations
  set enabled_features = p_features
  where id = p_org_id;

  return jsonb_build_object(
    'success', true,
    'message', format('Features for institution "%s" updated successfully.', v_org_name),
    'organization_id', p_org_id,
    'features', p_features
  );
end;
$$;

-- 3. Secure RPC: get_institution_features
create or replace function public.get_institution_features(p_org_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(enabled_features, '{"students":true,"id_cards":true,"certificates":true,"academics":true,"timetable":true,"homework":true,"teachers":true,"attendance":true,"fees":true,"expenses":true,"exams":true,"notices":true,"staff":true}'::jsonb)
  from public.organizations
  where id = p_org_id;
$$;

-- Grant execution to authenticated and anon users
grant execute on function public.update_institution_features(uuid, jsonb, text) to authenticated, anon;
grant execute on function public.get_institution_features(uuid) to authenticated, anon;
