-- Verifikasi PIN profil anak (ortu) untuk keluar mode anak; cocokkan dengan pin_hash.
-- Gunakan extensions.crypt (pgcrypto di schema extensions) agar aman di SECURITY DEFINER.
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
    and c.family_id = v_fam;
  if v_hash is null or length(btrim(v_hash)) < 1 then
    return false;
  end if;
  v_check := extensions.crypt(v_in, v_hash);
  return v_check is not null and v_check = v_hash;
end;
$$;

revoke all on function public.verify_child_profile_pin (uuid, text) from public;
grant execute on function public.verify_child_profile_pin (uuid, text) to authenticated;

comment on function public.verify_child_profile_pin (uuid, text) is
  'Ortu (sesi): cek PIN profil anak (bcrypt via extensions.crypt) sebelum keluar mode anak.';
