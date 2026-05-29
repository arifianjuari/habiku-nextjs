-- Fase 9.7: "Tahukah kamu" — tip edukatif harian yang dikurasi ortu.
--
-- Skema:
--   - `learning_tips` per family. Field: title, body, emoji, is_active, weight.
--   - RPC `pick_daily_tip(profile_id, day)` deterministik per (family, date)
--     menggunakan urutan md5 untuk memastikan seluruh perangkat melihat tip
--     yang sama pada hari yang sama.
--
-- RLS:
--   - SELECT: anggota family (ortu + anak) — agar anak bisa membaca via RPC.
--   - INSERT/UPDATE/DELETE: hanya peran ortu.

create table public.learning_tips (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  emoji text,
  title text not null check (char_length(trim(title)) between 1 and 80),
  body text not null check (char_length(trim(body)) between 1 and 400),
  is_active boolean not null default true,
  weight smallint not null default 1 check (weight between 1 and 5),
  created_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learning_tips_family_active_idx
  on public.learning_tips (family_id, is_active);

comment on table public.learning_tips is
  'Fase 9.7: koleksi tip edukatif harian per family; rotasi deterministik via pick_daily_tip.';

alter table public.learning_tips enable row level security;

-- SELECT: anggota family.
create policy "learning_tips_select_family"
  on public.learning_tips
  for select
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = auth.uid()
        and a.family_id = learning_tips.family_id
    )
    or exists (
      select 1
      from public.child_profiles c
      where c.id = auth.uid()
        and c.family_id = learning_tips.family_id
    )
  );

-- INSERT/UPDATE/DELETE: hanya ortu.
create policy "learning_tips_insert_parent"
  on public.learning_tips
  for insert
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = auth.uid()
        and a.family_id = learning_tips.family_id
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

create policy "learning_tips_update_parent"
  on public.learning_tips
  for update
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = auth.uid()
        and a.family_id = learning_tips.family_id
        and a.role in ('primary_parent', 'secondary_parent')
    )
  )
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = auth.uid()
        and a.family_id = learning_tips.family_id
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

create policy "learning_tips_delete_parent"
  on public.learning_tips
  for delete
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = auth.uid()
        and a.family_id = learning_tips.family_id
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

-- ------------------------------------------------------------------
-- RPC pick_daily_tip — deterministik per (family, date).
-- ------------------------------------------------------------------
create or replace function public.pick_daily_tip (
  p_profile_id uuid,
  p_day date default null
)
returns table (
  tip_id uuid,
  emoji text,
  title text,
  body text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day date;
  v_family_id uuid;
  v_caller_family uuid;
  v_caller_account uuid;
  v_tip_enabled boolean;
begin
  if p_profile_id is null then
    raise exception 'p_profile_id wajib diisi.';
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

  select coalesce(fs.daily_tip_enabled, true) into v_tip_enabled
  from public.family_settings fs
  where fs.family_id = v_family_id;
  if not coalesce(v_tip_enabled, true) then
    return;
  end if;

  if p_day is null then
    select (timezone(coalesce(f.timezone, 'UTC'), now()))::date
      into v_day
    from public.families f
    where f.id = v_family_id;
  else
    v_day := p_day;
  end if;

  return query
  select lt.id, lt.emoji, lt.title, lt.body
  from public.learning_tips lt
  where lt.family_id = v_family_id
    and lt.is_active = true
  order by md5(lt.id::text || v_day::text)
  limit 1;
end;
$$;

revoke all on function public.pick_daily_tip (uuid, date) from public;
grant execute on function public.pick_daily_tip (uuid, date) to authenticated;

comment on function public.pick_daily_tip (uuid, date) is
  'Fase 9.7: pilih 1 learning_tip aktif per (family, date) secara deterministik.';

-- ------------------------------------------------------------------
-- Seed 5 tip default per family yang sudah ada (best-effort).
-- ------------------------------------------------------------------
do $$
declare
  fam record;
begin
  for fam in select id from public.families loop
    insert into public.learning_tips (family_id, emoji, title, body, is_active)
    values
      (fam.id, '💧', 'Minum air dulu', 'Minum 1 gelas air sebelum mulai misi pertama hari ini.', true),
      (fam.id, '🧠', 'Belajar 25 menit', 'Pakai metode 25 menit fokus + 5 menit istirahat (Pomodoro).', true),
      (fam.id, '🤝', 'Sapa keluarga', 'Mulai hari dengan sapa orang di rumah dengan ramah.', true),
      (fam.id, '🌬️', 'Tarik napas pelan', 'Tarik napas 4 detik, tahan 4 detik, hembuskan 4 detik. Ulang 3 kali.', true),
      (fam.id, '📚', 'Baca 10 menit', 'Baca buku atau cerita 10 menit untuk asah imajinasi.', true)
    on conflict do nothing;
  end loop;
end $$;
