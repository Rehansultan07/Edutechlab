-- =====================================================================
-- Migration 0005: Secure Parent Portal Lookup & Child Information RPC
-- EduTechLab SaaS Platform
-- =====================================================================

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
