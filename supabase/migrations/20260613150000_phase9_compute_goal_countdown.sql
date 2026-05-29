-- Habiku Fase 9.2 — Hitung mundur target terdekat (PRD §14.2 / roadmap §9.A).
-- Input: profile_id (anak). Output: satu baris per goal status='active' yang
-- memuat estimasi hari sampai target tercapai berdasarkan rata-rata energi
-- 7 hari terakhir dari `task_history.status='approved'`.
--
-- Catatan keluaran:
--  - `days_left` = ceil((target_hp - current_hp) / max(1, avg_daily_energy)).
--  - `near_deadline` = days_left <= 7 (untuk styling pill kuning di klien).
--  - Goal yang HP-nya sudah ≥ target_hp dilewati (tidak akan kembali sebagai
--    'active' di flow normal, tapi defensif).
--  - Bila tidak ada approval 7 hari terakhir, `avg_daily_energy` = 0; kita
--    pakai sentinel 9999 di klien (tetap di server: days_left mengikuti
--    pembagian aman dengan greatest(1, n)).

create or replace function public.compute_goal_countdown (
  p_profile_id uuid
)
returns table (
  goal_id uuid,
  title text,
  current_hp int,
  target_hp int,
  avg_daily_energy numeric,
  days_left int,
  near_deadline boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_tz text;
  v_today date;
  v_avg numeric;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = p_profile_id;
  if v_family_id is null then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;

  -- Akses: ortu di keluarga yang sama (anak juga via sesi ortu di Child Mode).
  if not exists (
    select 1
    from public.accounts a
    where a.id = v_user
      and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_tz := (select f.timezone from public.families f where f.id = v_family_id);
  v_today := (timezone (coalesce (v_tz, 'UTC'), now ()))::date;

  -- Rata-rata energi/hari dari approval 7 hari terakhir (tanggal kalender keluarga).
  -- Pembagi tetap 7 supaya merepresentasikan "rata-rata 7 hari" (hari kosong = 0).
  select coalesce(sum(t.reward_points)::numeric / 7.0, 0) into v_avg
  from public.task_history th
  join public.tasks t on t.id = th.task_id
  where th.profile_id = p_profile_id
    and th.status = 'approved'
    and th.approved_at is not null
    and (timezone (coalesce (v_tz, 'UTC'), th.approved_at))::date
        between v_today - 6 and v_today;

  return query
    select g.id as goal_id,
           g.title,
           g.current_hp,
           g.target_hp,
           v_avg as avg_daily_energy,
           ceil(
             greatest(0, g.target_hp - g.current_hp)::numeric
             / greatest(1, v_avg)
           )::int as days_left,
           (
             ceil(
               greatest(0, g.target_hp - g.current_hp)::numeric
               / greatest(1, v_avg)
             )::int
           ) <= 7 as near_deadline
    from public.goals g
    where g.profile_id = p_profile_id
      and g.status = 'active'
      and g.target_hp > g.current_hp
    order by days_left asc, g.created_at asc;
end;
$$;

revoke all on function public.compute_goal_countdown (uuid) from public;
grant execute on function public.compute_goal_countdown (uuid) to authenticated;

comment on function public.compute_goal_countdown (uuid) is
  'Estimasi hari ke target per goal aktif (Fase 9.2): (target-current) / rata-rata energi 7 hari approved.';
