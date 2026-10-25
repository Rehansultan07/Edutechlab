-- =====================================================================
-- 0011: COMPREHENSIVE STAFF PERMISSIONS & SYNC RPC
-- Enables school admins to grant granular, feature-by-feature permissions
-- =====================================================================

-- 1. Ensure all comprehensive permissions are inserted into public.permissions
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

-- 2. Create RPC to sync & fetch all permissions with SECURITY DEFINER
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

-- 3. Ensure set_staff_permissions exists and handles all scenarios cleanly
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

grant execute on function public.set_staff_permissions(uuid, uuid[]) to authenticated;
