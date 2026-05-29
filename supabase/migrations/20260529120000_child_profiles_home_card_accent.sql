-- Warna kartu “Anak-anakmu” di beranda: opsional 0–3 = palet; null = otomatis (per jenis kelamin / urutan).
alter table public.child_profiles
  add column if not exists home_card_accent smallint;

alter table public.child_profiles
  drop constraint if exists child_profiles_home_card_accent_check;

alter table public.child_profiles
  add constraint child_profiles_home_card_accent_check
  check (home_card_accent is null or (home_card_accent >= 0 and home_card_accent <= 3));

comment on column public.child_profiles.home_card_accent is
  'Aksen kartu beranda: 0–3 = indeks palet; null = otomatis (jenis kelamin + urutan).';

-- Tambah p_home_card_accent: null = jangan ubah, 0–3 = set palet, 4 = kembalikan ke otomatis (null).
drop function if exists public.update_child_profile (uuid, text, text, date, public.child_gender, text, text);

create or replace function public.update_child_profile (
  p_profile_id uuid,
  p_name text default null,
  p_pin text default null,
  p_date_of_birth date default null,
  p_gender public.child_gender default null,
  p_avatar_preference text default null,
  p_avatar_emoji text default null,
  p_home_card_accent smallint default null
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

  if p_home_card_accent is not null then
    if p_home_card_accent = 4 then
      update public.child_profiles
      set home_card_accent = null, updated_at = now()
      where id = p_profile_id;
    elsif p_home_card_accent between 0 and 3 then
      update public.child_profiles
      set home_card_accent = p_home_card_accent, updated_at = now()
      where id = p_profile_id;
    else
      raise exception 'invalid_home_card_accent';
    end if;
  end if;
end;
$fn2$;

revoke all on function public.update_child_profile (uuid, text, text, date, public.child_gender, text, text, smallint) from public;
grant execute on function public.update_child_profile (uuid, text, text, date, public.child_gender, text, text, smallint) to authenticated;

comment on function public.update_child_profile (uuid, text, text, date, public.child_gender, text, text, smallint) is
  'Ortu: ubah nama, PIN, DOB, gender, preferensi avatar, aksen kartu beranda.';
