-- Fase 6.6 / 6.8 — Missed task log (FSD §4) + notifikasi in-app ortu saat 3 hari berturut per misi.
-- Jalankan `mark_missed_tasks_tick()` berkala (mis. tiap 15 menit) lewat Edge + cron atau pg_cron.
--
-- Ruang lingkup: hanya tasks `frequency_type` ∈ ('daily', 'custom') — selaras streak «hari penuh».
-- Weekly tidak ditandai missed harian (boleh perluasan terpisah).

-- ---------------------------------------------------------------------------
-- 1. Kolom (nilai enum `missed` ditambahkan di migrasi 20260614115900_* — transaksi terpisah)
-- ---------------------------------------------------------------------------

alter table public.task_history
  add column if not exists period_date date,
  add column if not exists missed_at timestamptz;

comment on column public.task_history.period_date is
  'Tanggal kalender periode (TZ keluarga). Untuk missed = hari tanpa submit yang valid.';
comment on column public.task_history.missed_at is
  'Catat sistem saat baris missed dibuat.';

-- Backfill period_date untuk baris lama (TZ keluarga, pakai completed_at).
update public.task_history th
set period_date = x.d
from (
  select
    th2.id,
    (timezone(coalesce(f.timezone, 'UTC'), th2.completed_at))::date as d
  from public.task_history th2
  join public.child_profiles c on c.id = th2.profile_id
  join public.families f on f.id = c.family_id
  where th2.period_date is null
) x
where th.id = x.id;

-- ---------------------------------------------------------------------------
-- 2. Unique: satu missed per (task, tanggal periode)
-- ---------------------------------------------------------------------------

create unique index if not exists task_history_missed_task_period_uidx
  on public.task_history (task_id, period_date)
  where (status = 'missed');

-- ---------------------------------------------------------------------------
-- 3. Trigger: set period_date pada submit anak (pending)
-- ---------------------------------------------------------------------------

create or replace function public.task_history_set_period_date_on_pending ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  if new.period_date is not null then
    return new;
  end if;

  select f.timezone
    into v_tz
  from public.child_profiles c
  join public.families f on f.id = c.family_id
  where c.id = new.profile_id;

  new.period_date := (timezone(coalesce(v_tz, 'UTC'), new.completed_at))::date;
  return new;
end;
$$;

drop trigger if exists trg_task_history_set_period_date on public.task_history;
create trigger trg_task_history_set_period_date
  before insert on public.task_history
  for each row
  execute function public.task_history_set_period_date_on_pending ();

comment on function public.task_history_set_period_date_on_pending () is
  'Fase 6: isi period_date untuk submit pending dari tanggal completed_at di TZ keluarga.';

-- ---------------------------------------------------------------------------
-- 4. RLS: klien hanya boleh INSERT status pending (missed hanya dari RPC)
-- ---------------------------------------------------------------------------

drop policy if exists "task_history_insert_family" on public.task_history;
create policy "task_history_insert_family"
  on public.task_history
  for insert
  to authenticated
  with check (
    status = 'pending'
    and exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.profile_id = task_history.profile_id
    )
    and profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Helper: urutan visual goal (FSD)
-- ---------------------------------------------------------------------------

create or replace function public._goal_visual_rank (p_state text)
returns int
language sql
immutable
as $$
  select case trim(lower(coalesce(p_state, 'fresh')))
    when 'fresh' then 0
    when 'slightly_wilted' then 1
    when 'wilted' then 2
    when 'dormant' then 3
    else 0
  end;
$$;

-- Hari kalender berturut ending p_end di mana profil punya ≥1 baris missed (misi apa pun).
create or replace function public._consecutive_missed_days_for_profile (
  p_profile_id uuid,
  p_end date
)
returns int
language plpgsql
stable
set search_path = public
as $$
declare
  v int := 0;
  d date := p_end;
begin
  loop
    exit when not exists (
      select 1
      from public.task_history th
      join public.tasks t on t.id = th.task_id
      where t.profile_id = p_profile_id
        and th.status = 'missed'
        and th.period_date = d
    );
    v := v + 1;
    d := d - 1;
  end loop;
  return v;
end;
$$;

create or replace function public._worsen_goals_visual_for_profile (
  p_profile_id uuid,
  p_period_end date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run int;
  v_new text;
  g record;
begin
  v_run := public._consecutive_missed_days_for_profile(p_profile_id, p_period_end);
  v_new := case
    when v_run >= 5 then 'dormant'
    when v_run >= 2 then 'wilted'
    when v_run >= 1 then 'slightly_wilted'
    else 'fresh'
  end;

  for g in
    select id, visual_state
    from public.goals
    where profile_id = p_profile_id
      and status = 'active'
  loop
    if public._goal_visual_rank(v_new) > public._goal_visual_rank(g.visual_state) then
      update public.goals
      set
        visual_state = v_new,
        updated_at = now()
      where id = g.id;
    end if;
  end loop;
end;
$$;

-- Panjang rangkaian hari missed *berturut* untuk satu misi, dihitung mundur dari p_end.
create or replace function public._task_consecutive_missed_days_ending (
  p_task_id uuid,
  p_profile_id uuid,
  p_end date
)
returns int
language plpgsql
stable
set search_path = public
as $$
declare
  v int := 0;
  d date := p_end;
begin
  loop
    exit when not exists (
      select 1
      from public.task_history th
      where th.task_id = p_task_id
        and th.profile_id = p_profile_id
        and th.status = 'missed'
        and th.period_date = d
    );
    v := v + 1;
    d := d - 1;
  end loop;
  return v;
end;
$$;

create or replace function public._notify_parents_task_missed_streak (
  p_family_id uuid,
  p_child_name text,
  p_task_title text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_msg text;
begin
  v_msg :=
    coalesce(nullif(trim(p_child_name), ''), 'Anak')
    || ' belum menyelesaikan «'
    || coalesce(nullif(trim(p_task_title), ''), 'Misi')
    || '» 3 hari berturut. Mungkin perlu diskusi ringan? 💬';

  for r in
    select a.id as account_id
    from public.accounts a
    where a.family_id = p_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  loop
    insert into public.notifications (recipient_id, recipient_type, type, content)
    values (r.account_id, 'account', 'task_missed_streak', v_msg);
  end loop;
end;
$$;

-- Satu hari kalender untuk satu keluarga: insert missed + efek samping.
create or replace function public._mark_missed_for_family_one_day (
  p_family_id uuid,
  p_period_date date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
  n int := 0;
  r record;
  v_ok boolean;
  v_family_id uuid;
begin
  begin
    select timezone
      into strict v_tz
    from public.families
    where id = p_family_id;
  exception
    when no_data_found then
      return 0;
  end;
  for r in
    select
      t.id as task_id,
      t.profile_id,
      t.title as task_title,
      t.category,
      c.name as child_name
    from public.tasks t
    join public.child_profiles c on c.id = t.profile_id
    where c.family_id = p_family_id
      and t.is_active = true
      and t.frequency_type in ('daily', 'custom')
  loop
    select exists (
      select 1
      from public.task_history th
      where th.task_id = r.task_id
        and th.profile_id = r.profile_id
        and th.status in ('pending', 'approved')
        and (timezone(coalesce(v_tz, 'UTC'), th.completed_at))::date = p_period_date
    )
    into v_ok;

    if v_ok then
      continue;
    end if;

    begin
      insert into public.task_history (
        task_id,
        profile_id,
        status,
        period_date,
        missed_at,
        completed_at,
        notes
      )
      values (
        r.task_id,
        r.profile_id,
        'missed'::public.task_history_status,
        p_period_date,
        now(),
        now(),
        'auto: tidak ada submit pending/approved pada periode ini (Fase 6).'
      );
      n := n + 1;

      update public.streaks
      set
        current_streak = 0,
        updated_at = now()
      where profile_id = r.profile_id
        and task_category = r.category;

      v_family_id := p_family_id;
      perform public._worsen_goals_visual_for_profile(r.profile_id, p_period_date);

      -- Notifikasi satu kali saat rangkaian **tepat** 3 hari (hindari spam hari ke-4+).
      if public._task_consecutive_missed_days_ending(r.task_id, r.profile_id, p_period_date) = 3 then
        perform public._notify_parents_task_missed_streak(
          v_family_id,
          r.child_name,
          r.task_title
        );
      end if;
    exception when unique_violation then
      -- sudah ada missed untuk (task, period)
      null;
    end;
  end loop;

  return n;
end;
$$;

-- Panggil untuk semua keluarga yang sedang berada di jendela 00:05–00:29 waktu lokal
-- (menandai hari **kemarin** di TZ masing-masing).
create or replace function public.mark_missed_tasks_tick ()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
  v_local_time time;
  v_yesterday date;
  total int := 0;
  n int;
begin
  for f in
    select id, coalesce(timezone, 'UTC') as tz
    from public.families
  loop
    v_local_time := (now() at time zone f.tz)::time;
    v_yesterday := (now() at time zone f.tz)::date - 1;

    if v_local_time >= time '00:05' and v_local_time < time '00:30' then
      n := public._mark_missed_for_family_one_day(f.id, v_yesterday);
      total := total + coalesce(n, 0);
    end if;
  end loop;

  return total;
end;
$$;

revoke all on function public.mark_missed_tasks_tick () from public;
grant execute on function public.mark_missed_tasks_tick () to service_role;

comment on function public.mark_missed_tasks_tick () is
  'Fase 6: per keluarga di jendela 00:05–00:29 waktu lokal, tandai missed untuk hari kalender kemarin. Idempoten.';

-- Hardening: helper internal tidak diekspos ke anon/authenticated.
revoke all on function public._worsen_goals_visual_for_profile (uuid, date) from public;
revoke all on function public._notify_parents_task_missed_streak (uuid, text, text) from public;
revoke all on function public._mark_missed_for_family_one_day (uuid, date) from public;
