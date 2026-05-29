-- Fase 9.11: Refleksi sore — enum mood tertutup + tabel `child_daily_reflections`
-- + RPC `submit_child_reflection`. UNIQUE per (profile_id, reflection_date)
-- agar 1 baris per hari (idempotent upsert).

create type public.reflection_mood as enum (
  'sangat_senang', -- 😄
  'senang',        -- 🙂
  'biasa',         -- 😐
  'kurang_senang'  -- 😟
);

create table public.child_daily_reflections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  reflection_date date not null,
  mood public.reflection_mood not null,
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, reflection_date)
);

create index child_daily_reflections_profile_idx
  on public.child_daily_reflections (profile_id, reflection_date desc);

comment on table public.child_daily_reflections is
  'Fase 9.11: refleksi sore harian anak (1 baris/hari). RPC submit_child_reflection upsert.';
comment on column public.child_daily_reflections.note is
  'Catatan opsional dari anak (≤ 280 karakter).';

alter table public.child_daily_reflections enable row level security;

-- SELECT: anggota family (ortu + anak yang sama).
create policy "child_reflections_select_family"
  on public.child_daily_reflections
  for select
  using (
    exists (
      select 1
      from public.child_profiles c
        join public.accounts a on a.family_id = c.family_id
      where c.id = child_daily_reflections.profile_id
        and a.id = auth.uid()
    )
    or exists (
      select 1
      from public.child_profiles c
      where c.id = child_daily_reflections.profile_id
        and c.id = auth.uid()
    )
  );

-- INSERT/UPDATE hanya via RPC SECURITY DEFINER `submit_child_reflection`.

-- ------------------------------------------------------------------
-- RPC submit_child_reflection — upsert per (profile_id, reflection_date).
-- ------------------------------------------------------------------
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
  v_id uuid;
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

  insert into public.child_daily_reflections (profile_id, reflection_date, mood, note)
  values (p_profile_id, v_today, p_mood, v_note)
  on conflict (profile_id, reflection_date) do update
    set mood = excluded.mood,
        note = excluded.note,
        updated_at = now()
  returning child_daily_reflections.id into v_id;

  return query
  select r.id, r.reflection_date, r.mood, r.note
  from public.child_daily_reflections r
  where r.id = v_id;
end;
$$;

revoke all on function public.submit_child_reflection (uuid, public.reflection_mood, text) from public;
grant execute on function public.submit_child_reflection (uuid, public.reflection_mood, text) to authenticated;

comment on function public.submit_child_reflection (uuid, public.reflection_mood, text) is
  'Fase 9.11: upsert refleksi sore anak per hari (1 baris per profile+date).';
