-- Klien tidak punya UPDATE pada child_profiles (Fase 3). Preferensi avatar sebelumnya
-- dicoba lewat .update() dan gagal diam-diam / di akhir. Gabung ke RPC update_child_profile.

drop function if exists public.update_child_profile (uuid, text, text, date, public.child_gender);

create or replace function public.update_child_profile (
  p_profile_id uuid,
  p_name text default null,
  p_pin text default null,
  p_date_of_birth date default null,
  p_gender public.child_gender default null,
  p_avatar_preference text default null,
  p_avatar_emoji text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $fn2$
declare
  v_user uuid := auth.uid();
  v_hash text;
  v_emoji text;
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

  if p_avatar_preference is not null then
    if p_avatar_preference is distinct from 'photo'
       and p_avatar_preference is distinct from 'emoji' then
      raise exception 'invalid_avatar_preference';
    end if;
    v_emoji := null;
    if p_avatar_emoji is not null and length(trim(p_avatar_emoji)) >= 1 then
      v_emoji := trim(p_avatar_emoji);
    end if;
    update public.child_profiles
    set
      avatar_preference = p_avatar_preference,
      avatar_emoji = v_emoji,
      updated_at = now()
    where id = p_profile_id;
  end if;
end;
$fn2$;

revoke all on function public.update_child_profile (uuid, text, text, date, public.child_gender, text, text) from public;
grant execute on function public.update_child_profile (uuid, text, text, date, public.child_gender, text, text) to authenticated;

comment on function public.update_child_profile (uuid, text, text, date, public.child_gender, text, text) is
  'Ortu: ubah nama, PIN, tanggal lahir, gender, preferensi foto/emoji (tanpa grant UPDATE ke klien).';
