-- Fase 3.1: profil anak — PIN di-hash di server (pgcrypto), Storage avatar privat,
--            insert/update baris child_profiles hanya lewat RPC (kecuali avatar path via RPC khusus).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- RPC: buat profil anak (PIN tidak disimpan plaintext)
-- ---------------------------------------------------------------------------

create or replace function public.create_child_profile (p_name text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
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

  v_hash := crypt(p_pin, gen_salt('bf'));

  insert into public.child_profiles (family_id, name, pin_hash)
  values (v_fam, trim(p_name), v_hash)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_child_profile (text, text) from public;
grant execute on function public.create_child_profile (text, text) to authenticated;

comment on function public.create_child_profile (text, text) is
  'Ortu: tambah profil anak; PIN di-hash bcrypt di server.';

-- ---------------------------------------------------------------------------
-- RPC: ubah nama dan/atau PIN (PIN opsional — null atau '''' = tidak diubah)
-- ---------------------------------------------------------------------------

create or replace function public.update_child_profile (
  p_profile_id uuid,
  p_name text default null,
  p_pin text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
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
end;
$$;

revoke all on function public.update_child_profile (uuid, text, text) from public;
grant execute on function public.update_child_profile (uuid, text, text) to authenticated;

comment on function public.update_child_profile (uuid, text, text) is
  'Ortu: ubah nama anak dan/atau PIN (PIN di-hash di server).';

-- ---------------------------------------------------------------------------
-- RPC: set path objek Storage di kolom avatar_url (bukan URL publik)
--      Format disarankan: "<profile_id>/avatar.jpg"
-- ---------------------------------------------------------------------------

create or replace function public.set_child_profile_avatar_path (
  p_profile_id uuid,
  p_storage_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text := trim(p_storage_path);
begin
  if auth.uid() is null then
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
  if v_clean is null or length(v_clean) < 3 then
    raise exception 'invalid_path';
  end if;

  update public.child_profiles
  set avatar_url = v_clean, updated_at = now()
  where id = p_profile_id;
end;
$$;

revoke all on function public.set_child_profile_avatar_path (uuid, text) from public;
grant execute on function public.set_child_profile_avatar_path (uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- child_profiles: cabut insert/update langsung dari klien (pakai RPC)
-- ---------------------------------------------------------------------------

drop policy if exists "child_profiles_insert_parent" on public.child_profiles;
drop policy if exists "child_profiles_update_parent" on public.child_profiles;

revoke insert, update on public.child_profiles from authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket privat untuk foto profil anak
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('child-avatars', 'child-avatars', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "child_avatars_select_family" on storage.objects;
drop policy if exists "child_avatars_insert_family" on storage.objects;
drop policy if exists "child_avatars_update_family" on storage.objects;
drop policy if exists "child_avatars_delete_family" on storage.objects;

create policy "child_avatars_select_family"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'child-avatars'
    and exists (
      select 1
      from public.child_profiles c
      where c.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  );

create policy "child_avatars_insert_family"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'child-avatars'
    and exists (
      select 1
      from public.child_profiles c
      where c.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  );

create policy "child_avatars_update_family"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'child-avatars'
    and exists (
      select 1
      from public.child_profiles c
      where c.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  )
  with check (
    bucket_id = 'child-avatars'
    and exists (
      select 1
      from public.child_profiles c
      where c.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  );

create policy "child_avatars_delete_family"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'child-avatars'
    and exists (
      select 1
      from public.child_profiles c
      where c.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  );
