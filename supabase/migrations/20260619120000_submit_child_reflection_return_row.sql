-- Pastikan submit_child_reflection selalu mengembalikan baris yang baru di-upsert.
-- Hindari bentrok nama: kolom RETURNS TABLE jadi variabel PL/pgSQL → qualifier ON CONFLICT
-- dan RETURN QUERY memakai subquery ber-alias.

create or replace function public.submit_child_reflection (
  p_profile_id uuid,
  p_mood public.reflection_mood,
  p_note text default null
)
returns table (
  id uuid,
  reflection_date date,
  mood public.reflection_mood,
  note text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_caller_family uuid;
  v_caller_account uuid;
  v_tz text;
  v_today date;
  v_note text;
begin
  if p_profile_id is null then
    raise exception 'p_profile_id wajib diisi.';
  end if;
  if p_mood is null then
    raise exception 'mood wajib diisi.';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = p_profile_id;
  if v_family_id is null then
    raise exception 'Profil anak tidak ditemukan.';
  end if;

  select a.id, a.family_id into v_caller_account, v_caller_family
  from public.accounts a
  where a.id = auth.uid();
  if v_caller_account is null then
    if not exists (
      select 1 from public.child_profiles c2
      where c2.id = auth.uid() and c2.family_id = v_family_id
    ) then
      raise exception 'Tidak diizinkan: caller bukan anggota keluarga.';
    end if;
  elsif v_caller_family is distinct from v_family_id then
    raise exception 'Tidak diizinkan: lintas keluarga.';
  end if;

  v_tz := (select f.timezone from public.families f where f.id = v_family_id);
  v_today := (timezone(coalesce(v_tz, 'UTC'), now()))::date;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 280 then
    v_note := left(v_note, 280);
  end if;

  -- EXECUTE + USING: hindari bentrok nama kolom output vs daftar kolom INSERT / ON CONFLICT.
  execute
    'insert into public.child_daily_reflections (profile_id, reflection_date, mood, note)
     values ($1, $2, $3, $4)
     on conflict on constraint child_daily_reflections_profile_id_reflection_date_key
     do update set
       mood = excluded.mood,
       note = excluded.note,
       updated_at = now()'
  using p_profile_id, v_today, p_mood, v_note;

  -- Subquery ber-alias: hindari bentrok reflection_date / id / mood / note dengan variabel output.
  return query
  select s.out_id, s.out_rd, s.out_m, s.out_n
  from (
    select
      r.id as out_id,
      r.reflection_date as out_rd,
      r.mood as out_m,
      r.note as out_n
    from public.child_daily_reflections r
    where r.profile_id = p_profile_id
      and r.reflection_date = v_today
  ) s;
end;
$$;
