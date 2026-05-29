-- Tanggal lahir + jenis kelamin (prototipe ChildProfileFormMock); enum selaras app (female/male/other).

do $e$
begin
  if not exists (
    select 1
    from pg_catalog.pg_type t
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'child_gender'
  ) then
    create type public.child_gender as enum ('female', 'male', 'other');
  end if;
end;
$e$;

alter table public.child_profiles
  add column if not exists date_of_birth date,
  add column if not exists gender public.child_gender not null default 'other';

comment on column public.child_profiles.date_of_birth is
  'Tanggal lahir; dipakai hitung usia (UI).';
comment on column public.child_profiles.gender is
  'Aksen kartu beranda: female / male / other.';

-- Ganti tanda tangan RPC (tambah parameter)
drop function if exists public.create_child_profile (text, text);
drop function if exists public.create_child_profile (text, text, date, public.child_gender);

create or replace function public.create_child_profile (
  p_name text,
  p_pin text,
  p_date_of_birth date,
  p_gender public.child_gender default 'other'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_user uuid := auth.uid();
  v_fam uuid;
  v_id uuid;
  v_hash text;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  v_fam := public.current_family_id();
  if v_fam is null then
    raise exception 'no_family';
  end if;
  if public.current_account_role() is distinct from 'primary_parent'
     and public.current_account_role() is distinct from 'secondary_parent' then
    raise exception 'forbidden';
  end if;
  if p_name is null or length(trim(p_name)) < 1 then
    raise exception 'name_required';
  end if;
  if p_pin is null or length(p_pin) < 4 or length(p_pin) > 12 then
    raise exception 'pin_invalid_length';
  end if;
  if p_pin !~ '^[0-9]+$' then
    raise exception 'pin_digits_only';
  end if;
  if p_date_of_birth is null then
    raise exception 'date_of_birth_required';
  end if;
  if p_date_of_birth > current_date then
    raise exception 'date_of_birth_future';
  end if;

  v_hash := crypt(p_pin, gen_salt('bf'));

  insert into public.child_profiles (family_id, name, pin_hash, date_of_birth, gender)
  values (v_fam, trim(p_name), v_hash, p_date_of_birth, coalesce(p_gender, 'other'::public.child_gender))
  returning id into v_id;

  return v_id;
end;
$fn$;

revoke all on function public.create_child_profile (text, text, date, public.child_gender) from public;
grant execute on function public.create_child_profile (text, text, date, public.child_gender) to authenticated;

comment on function public.create_child_profile (text, text, date, public.child_gender) is
  'Ortu: tambah profil anak; PIN di-hash; DOB + gender.';

drop function if exists public.update_child_profile (uuid, text, text);

create or replace function public.update_child_profile (
  p_profile_id uuid,
  p_name text default null,
  p_pin text default null,
  p_date_of_birth date default null,
  p_gender public.child_gender default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $fn2$
declare
  v_user uuid := auth.uid();
  v_hash text;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if public.current_account_role() is distinct from 'primary_parent'
     and public.current_account_role() is distinct from 'secondary_parent' then
    raise exception 'forbidden';
  end if;
  if not exists (
    select 1
    from public.child_profiles c
    where c.id = p_profile_id
      and c.family_id = public.current_family_id()
  ) then
    raise exception 'forbidden';
  end if;

  if p_name is not null and length(trim(p_name)) >= 1 then
    update public.child_profiles
    set name = trim(p_name), updated_at = now()
    where id = p_profile_id;
  end if;

  if p_pin is not null and length(trim(p_pin)) > 0 then
    if length(trim(p_pin)) < 4 or length(trim(p_pin)) > 12 then
      raise exception 'pin_invalid_length';
    end if;
    if trim(p_pin) !~ '^[0-9]+$' then
      raise exception 'pin_digits_only';
    end if;
    v_hash := crypt(trim(p_pin), gen_salt('bf'));
    update public.child_profiles
    set pin_hash = v_hash, updated_at = now()
    where id = p_profile_id;
  end if;

  if p_date_of_birth is not null then
    if p_date_of_birth > current_date then
      raise exception 'date_of_birth_future';
    end if;
    update public.child_profiles
    set date_of_birth = p_date_of_birth, updated_at = now()
    where id = p_profile_id;
  end if;

  if p_gender is not null then
    update public.child_profiles
    set gender = p_gender, updated_at = now()
    where id = p_profile_id;
  end if;
end;
$fn2$;

revoke all on function public.update_child_profile (uuid, text, text, date, public.child_gender) from public;
grant execute on function public.update_child_profile (uuid, text, text, date, public.child_gender) to authenticated;

comment on function public.update_child_profile (uuid, text, text, date, public.child_gender) is
  'Ortu: ubah nama, PIN, tanggal lahir, gender (PIN & tanggal: validasi di server).';
