-- =====================================================================
-- 0012: STUDENT PROMOTION, CLASS RESHUFFLE & SESSION ARCHIVAL
-- =====================================================================

-- 1. Student Academic History / Archival Table
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
  action text not null default 'promoted', -- 'promoted', 'detained', 'graduated', 'reshuffled'
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

-- 2. Atomic Batch Promotion RPC
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

    -- 1. Insert history record
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

    -- 2. Update Student current class & status
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

    -- 3. Carry forward dues into student_fee_months if specified
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
