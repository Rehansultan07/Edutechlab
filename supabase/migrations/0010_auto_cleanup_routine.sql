-- =====================================================================
-- 0010: SYSTEM AUTOMATED CLEANUP ROUTINE
-- Policies:
-- 1. Class Homework: Auto-delete records older than 90 days
-- 2. Notices & Circulars: Auto-delete records older than 90 days
-- 3. Staff Invites: Auto-delete records older than 90 days
-- 4. Approved Subscription Payments & Screenshots: Auto-delete after 7 days (1 week)
-- =====================================================================

create or replace function public.run_system_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_homework_count integer := 0;
  v_notices_count integer := 0;
  v_invites_count integer := 0;
  v_payments_count integer := 0;
  v_storage_files_count integer := 0;
  v_target_paths text[];
begin
  -- 1. Class Homework: Auto-delete older than 90 days
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'class_homework') then
    with deleted_hw as (
      delete from public.class_homework
      where assigned_date < (current_date - interval '90 days')
      returning id
    )
    select count(*) into v_homework_count from deleted_hw;
  end if;

  -- 2. Notices & Circulars: Auto-delete older than 90 days
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notices') then
    with deleted_notices as (
      delete from public.notices
      where created_at < (now() - interval '90 days')
      returning id
    )
    select count(*) into v_notices_count from deleted_notices;
  end if;

  -- 3. Staff Invites: Auto-delete older than 90 days
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'staff_invites') then
    with deleted_invites as (
      delete from public.staff_invites
      where created_at < (now() - interval '90 days')
      returning id
    )
    select count(*) into v_invites_count from deleted_invites;
  end if;

  -- 4. Approved Subscription Payments (Purged after 7 days / 1 week)
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'subscription_payments') then
    -- A. Extract storage paths for approved payments older than 7 days
    select array_agg(
      regexp_replace(screenshot_url, '^.*/subscription-proofs/', '')
    )
    into v_target_paths
    from public.subscription_payments
    where status = 'approved'
      and reviewed_at is not null
      and reviewed_at < (now() - interval '7 days')
      and screenshot_url is not null;

    -- B. Delete actual files from storage.objects
    if v_target_paths is not null and array_length(v_target_paths, 1) > 0 then
      with deleted_storage as (
        delete from storage.objects
        where bucket_id = 'subscription-proofs'
          and name = any(v_target_paths)
        returning id
      )
      select count(*) into v_storage_files_count from deleted_storage;
    end if;

    -- C. Delete the payment records older than 7 days
    with deleted_pay as (
      delete from public.subscription_payments
      where status = 'approved'
        and reviewed_at is not null
        and reviewed_at < (now() - interval '7 days')
      returning id
    )
    select count(*) into v_payments_count from deleted_pay;
  end if;

  return jsonb_build_object(
    'success', true,
    'homework_deleted', v_homework_count,
    'notices_deleted', v_notices_count,
    'invites_deleted', v_invites_count,
    'approved_payments_deleted', v_payments_count,
    'storage_files_deleted', v_storage_files_count,
    'executed_at', now()
  );
end;
$$;

grant execute on function public.run_system_cleanup() to authenticated, anon;
