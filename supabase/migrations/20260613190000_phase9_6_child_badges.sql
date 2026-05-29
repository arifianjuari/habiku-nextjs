-- Fase 9.6: Koleksi badge anak.
--
-- Tabel `child_badges`: 1 baris per (profile_id, badge_key) — bukti unlock.
-- RLS: anggota family bisa membaca; hanya server-side RPC (SECURITY DEFINER)
-- yang menulis (tidak ada policy INSERT untuk client biasa).
--
-- RPC `award_eligible_badges(profile_id)`: dijalankan setelah `approve_task_history`
-- (via trigger di task_history) dan dapat dipanggil manual untuk bootstrap.
-- Predikat dipertimbangkan deterministik berdasarkan state tabel:
--   - first_steps          : ada ≥1 task_history.approved
--   - mission_5            : ≥5 task_history.approved
--   - mission_25           : ≥25 task_history.approved
--   - streak_3_any         : streaks.current_streak ≥ 3 di kategori manapun
--   - streak_7_any         : streaks.current_streak ≥ 7 di kategori manapun
--   - goal_first           : ≥1 goals.status='completed'
--   - goal_3               : ≥3 goals.status='completed'
--   - check_in_7           : daily_check_ins ≥ 7 baris
--   - bonus_featured       : ada ≥1 point_ledger.amount > task.reward_points
--                            via task_history.task_id (proxy: ledger.amount > base)
--
-- Tabel diisi sekali per badge per anak (UNIQUE) — pemanggilan ulang aman.

create table public.child_badges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  badge_key text not null,
  awarded_at timestamptz not null default now(),
  unique (profile_id, badge_key)
);

create index child_badges_profile_idx
  on public.child_badges (profile_id, awarded_at desc);

comment on table public.child_badges is
  'Fase 9.6: koleksi badge per profil anak; UNIQUE per (profile_id, badge_key).';

alter table public.child_badges enable row level security;

create policy "child_badges_select_family"
  on public.child_badges
  for select
  using (
    exists (
      select 1
      from public.child_profiles c
        join public.accounts a on a.family_id = c.family_id
      where c.id = child_badges.profile_id
        and a.id = auth.uid()
    )
    or exists (
      select 1
      from public.child_profiles c
      where c.id = child_badges.profile_id
        and c.id = auth.uid()
    )
  );

-- Tidak ada policy INSERT/UPDATE/DELETE untuk klien — write hanya via RPC
-- SECURITY DEFINER (`award_eligible_badges`).

-- ------------------------------------------------------------------
-- RPC award_eligible_badges
-- ------------------------------------------------------------------
create or replace function public.award_eligible_badges (p_profile_id uuid)
returns table (badge_key text, awarded_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_caller_family uuid;
  v_caller_account uuid;
  v_count_approved int;
  v_max_streak int;
  v_count_completed_goals int;
  v_count_check_ins int;
  v_has_featured_bonus boolean;
  v_keys text[];
  k text;
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

  -- Validasi caller (akun ortu sefamily atau profil anak yang sama).
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

  -- Kumpulkan agregat sederhana.
  select count(*)::int into v_count_approved
  from public.task_history th
  where th.profile_id = p_profile_id and th.status = 'approved';

  select coalesce(max(s.current_streak), 0)::int into v_max_streak
  from public.streaks s
  where s.profile_id = p_profile_id;

  select count(*)::int into v_count_completed_goals
  from public.goals g
  where g.profile_id = p_profile_id and g.status = 'completed';

  select count(*)::int into v_count_check_ins
  from public.daily_check_ins ci
  where ci.profile_id = p_profile_id;

  -- Bonus featured: ada minimal 1 point_ledger.amount lebih besar dari
  -- tasks.reward_points untuk task yang sama (pertanda multiplier diterapkan).
  select exists (
    select 1
    from public.point_ledger pl
      join public.task_history th on th.id = pl.task_history_id
      join public.tasks t on t.id = th.task_id
    where pl.profile_id = p_profile_id
      and pl.type = 'earn'
      and pl.amount > t.reward_points
  ) into v_has_featured_bonus;

  -- Susun daftar badge yang seharusnya unlock berdasarkan agregat.
  v_keys := array[]::text[];
  if v_count_approved >= 1 then v_keys := v_keys || array['first_steps']; end if;
  if v_count_approved >= 5 then v_keys := v_keys || array['mission_5']; end if;
  if v_count_approved >= 25 then v_keys := v_keys || array['mission_25']; end if;
  if v_max_streak >= 3 then v_keys := v_keys || array['streak_3_any']; end if;
  if v_max_streak >= 7 then v_keys := v_keys || array['streak_7_any']; end if;
  if v_count_completed_goals >= 1 then v_keys := v_keys || array['goal_first']; end if;
  if v_count_completed_goals >= 3 then v_keys := v_keys || array['goal_3']; end if;
  if v_count_check_ins >= 7 then v_keys := v_keys || array['check_in_7']; end if;
  if v_has_featured_bonus then v_keys := v_keys || array['bonus_featured']; end if;

  -- Insert idempotent.
  foreach k in array v_keys loop
    insert into public.child_badges (profile_id, badge_key)
    values (p_profile_id, k)
    on conflict (profile_id, badge_key) do nothing;
  end loop;

  return query
  select cb.badge_key, cb.awarded_at
  from public.child_badges cb
  where cb.profile_id = p_profile_id
  order by cb.awarded_at desc;
end;
$$;

revoke all on function public.award_eligible_badges (uuid) from public;
grant execute on function public.award_eligible_badges (uuid) to authenticated;

comment on function public.award_eligible_badges (uuid) is
  'Fase 9.6: evaluasi katalog badge dan UPSERT ke child_badges (idempotent).';

-- ------------------------------------------------------------------
-- Trigger after-approve di task_history → panggil award_eligible_badges
-- ------------------------------------------------------------------
create or replace function public.trigger_award_badges_on_approve ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and (old.status is null or old.status is distinct from 'approved') then
    -- Best-effort: jangan throw kalau ada error agar approval tidak gagal.
    begin
      perform public.award_eligible_badges(new.profile_id);
    exception when others then
      raise warning '[award_eligible_badges] %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_history_award_badges on public.task_history;
create trigger trg_task_history_award_badges
  after update of status on public.task_history
  for each row
  execute function public.trigger_award_badges_on_approve ();

comment on function public.trigger_award_badges_on_approve () is
  'Fase 9.6: setelah task_history disetujui, evaluasi & unlock badge baru (best-effort).';
