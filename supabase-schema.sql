-- ระบบลงทะเบียนเรียน วิทยาลัยเทคนิคนางรอง
-- เปิด SQL Editor ใน Supabase แล้ววางโค้ดทั้งหมดนี้และกด RUN

create extension if not exists pgcrypto;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  student_code text not null unique,
  full_name text not null,
  citizen_id text not null,
  dob date not null,
  phone text not null,
  address text not null,
  department text not null,
  major text not null,
  level text not null,
  academic_year text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin'))
);

alter table public.registrations enable row level security;
alter table public.user_roles enable row level security;

-- ตรวจสิทธิ์ Admin โดยไม่เปิดเผยตารางสิทธิ์
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

-- นักเรียนส่งแบบฟอร์มได้ผ่านฟังก์ชันนี้เท่านั้น
create or replace function public.register_student(
  p_student_code text, p_full_name text, p_citizen_id text, p_dob date,
  p_phone text, p_address text, p_department text, p_major text,
  p_level text, p_academic_year text
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if length(trim(p_student_code)) < 1 or length(trim(p_full_name)) < 2 then
    raise exception 'กรุณากรอกรหัสผู้สมัครและชื่อ-นามสกุลให้ถูกต้อง';
  end if;
  if p_citizen_id !~ '^[0-9]{13}$' then raise exception 'เลขบัตรประชาชนต้องมี 13 หลัก'; end if;
  if p_level not in ('ปวช.','ปวส.','อื่น ๆ') then raise exception 'ระดับการศึกษาไม่ถูกต้อง'; end if;
  insert into public.registrations(student_code,full_name,citizen_id,dob,phone,address,department,major,level,academic_year)
  values(trim(p_student_code),trim(p_full_name),trim(p_citizen_id),p_dob,trim(p_phone),trim(p_address),
         trim(p_department),trim(p_major),p_level,trim(p_academic_year));
end;
$$;

-- แสดงเฉพาะข้อมูลรายชื่อที่ไม่ใช่ข้อมูลส่วนตัว
create or replace function public.public_student_directory()
returns table(id uuid, student_code text, full_name text, department text, major text, created_at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select r.id,r.student_code,r.full_name,r.department,r.major,r.created_at
  from public.registrations r order by r.created_at desc;
$$;

-- เฉพาะ Admin เท่านั้นที่อ่าน/แก้ไข/ลบข้อมูลเต็มได้
drop policy if exists "Admin can read registrations" on public.registrations;
create policy "Admin can read registrations" on public.registrations for select to authenticated using (public.is_admin());
drop policy if exists "Admin can insert registrations" on public.registrations;
create policy "Admin can insert registrations" on public.registrations for insert to authenticated with check (public.is_admin());
drop policy if exists "Admin can update registrations" on public.registrations;
create policy "Admin can update registrations" on public.registrations for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin can delete registrations" on public.registrations;
create policy "Admin can delete registrations" on public.registrations for delete to authenticated using (public.is_admin());

drop policy if exists "User can read own role" on public.user_roles;
create policy "User can read own role" on public.user_roles for select to authenticated using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant execute on function public.register_student(text,text,text,date,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.public_student_directory() to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant select, insert, update, delete on public.registrations to authenticated;
grant select on public.user_roles to authenticated;

-- หลังสร้างบัญชี Admin ใน Authentication > Users แล้ว
-- คัดลอก UUID ของบัญชีนั้นมาแทน YOUR_ADMIN_USER_UUID แล้วรัน:
-- insert into public.user_roles(user_id, role)
-- values ('YOUR_ADMIN_USER_UUID', 'admin')
-- on conflict (user_id) do update set role = 'admin';
