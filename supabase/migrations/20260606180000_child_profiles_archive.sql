-- Arsip profil anak (soft delete) — data misi/poin/target tetap; bisa dipulihkan ortu.

alter table public.child_profiles
  add column if not exists archived_at timestamptz;

comment on column public.child_profiles.archived_at is
  'Waktu diarsipkan ortu; null = aktif. Arsip menyembunyikan profil tanpa menghapus riwayat.';

create index if not exists child_profiles_family_active_idx
  on public.child_profiles (family_id)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- RPC: arsip & pulihkan (ortu, SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create or replace function public.archive_child_profile (p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if public.current_account_role() is distinct from 'primary_parent'
     and public.current_account_role() is distinct from 'secondary_parent' then
    raise exception 'forbidden';
  end if;
  if p_profile_id is null then
    raise exception 'profile_required';
  end if;

  update public.child_profiles
  set archived_at = now(), updated_at = now()
  where id = p_profile_id
    and family_id = public.current_family_id()
    and archived_at is null;

  if not found then
    raise exception 'profile_not_found_or_already_archived';
  end if;
end;
$$;

create or replace function public.restore_child_profile (p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if public.current_account_role() is distinct from 'primary_parent'
     and public.current_account_role() is distinct from 'secondary_parent' then
    raise exception 'forbidden';
  end if;
  if p_profile_id is null then
    raise exception 'profile_required';
  end if;

  update public.child_profiles
  set archived_at = null, updated_at = now()
  where id = p_profile_id
    and family_id = public.current_family_id()
    and archived_at is not null;

  if not found then
    raise exception 'profile_not_found_or_not_archived';
  end if;
end;
$$;

revoke all on function public.archive_child_profile (uuid) from public;
grant execute on function public.archive_child_profile (uuid) to authenticated;

revoke all on function public.restore_child_profile (uuid) from public;
grant execute on function public.restore_child_profile (uuid) to authenticated;

comment on function public.archive_child_profile (uuid) is
  'Ortu: arsip profil anak (soft delete); riwayat misi/poin/target tetap.';
comment on function public.restore_child_profile (uuid) is
  'Ortu: pulihkan profil anak dari arsip.';

-- Mode anak: tolak PIN untuk profil yang diarsipkan
create or replace function public.verify_child_profile_pin (p_profile_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid;
  v_fam uuid;
  v_hash text;
  v_in text;
  v_check text;
begin
  v_user := auth.uid();
  if v_user is null then
    return false;
  end if;
  select a.family_id into v_fam
  from public.accounts a
  where a.id = v_user
  limit 1;
  if v_fam is null then
    return false;
  end if;
  if p_profile_id is null then
    return false;
  end if;
  v_in := nullif(trim(p_pin), '');
  if v_in is null or length(v_in) < 4 or length(v_in) > 12 or v_in !~ '^[0-9]+$' then
    return false;
  end if;
  select c.pin_hash into v_hash
  from public.child_profiles c
  where c.id = p_profile_id
    and c.family_id = v_fam
    and c.archived_at is null;
  if v_hash is null or length(btrim(v_hash)) < 1 then
    return false;
  end if;
  v_check := extensions.crypt(v_in, v_hash);
  return v_check is not null and v_check = v_hash;
end;
$$;
