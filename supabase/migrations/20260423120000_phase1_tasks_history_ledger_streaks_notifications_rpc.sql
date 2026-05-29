-- Habiku — Fase 1.6–1.10: tasks, task_history, ledger, goal progress, streaks, notifications
-- + RPC approve (atomik) / reject (hanya task_history) — mengacu docs/implementation-roadmap-react.md & prd-habiku-react.md

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.frequency_type as enum ('daily', 'weekly', 'custom');

create type public.task_category as enum (
  'ibadah',
  'belajar',
  'kebersihan',
  'olahraga',
  'lainnya'
);

create type public.ledger_type as enum ('earn', 'spend', 'adjustment');

create type public.task_history_status as enum ('pending', 'approved', 'rejected');

create type public.notification_recipient_type as enum ('account', 'profile');

-- ---------------------------------------------------------------------------
-- 1.6 tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  title text not null,
  category public.task_category not null default 'lainnya',
  reward_points int not null check (reward_points > 0),
  frequency_type public.frequency_type not null default 'daily',
  frequency_config jsonb not null default '{}',
  max_submissions_per_period int not null default 1 check (max_submissions_per_period > 0),
  linked_attribute text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_profile_id_idx on public.tasks (profile_id);

comment on table public.tasks is 'Misi per anak; frekuensi & batas submit via frequency_* + max_submissions.';

-- ---------------------------------------------------------------------------
-- 1.7 task_history
-- ---------------------------------------------------------------------------

create table public.task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  status public.task_history_status not null default 'pending',
  evidence_url text,
  notes text,
  completed_at timestamptz not null default now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  approved_by_account_id uuid references public.accounts (id) on delete set null,
  rejected_by_account_id uuid references public.accounts (id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index task_history_task_id_idx on public.task_history (task_id);
create index task_history_profile_id_idx on public.task_history (profile_id);
create index task_history_pending_parent_queue_idx
  on public.task_history (profile_id, status, created_at)
  where (status = 'pending');

comment on table public.task_history is 'Persetujuan ortu: pending → approved/reject; poin hanya lewat RPC approve.';

-- ---------------------------------------------------------------------------
-- 1.8 point_ledger, goal_progress_events, streaks, notifications
-- ---------------------------------------------------------------------------

create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  amount int not null,
  type public.ledger_type not null,
  task_history_id uuid references public.task_history (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index point_ledger_one_earn_per_task_history_uidx
  on public.point_ledger (task_history_id)
  where (type = 'earn' and task_history_id is not null);

create index point_ledger_profile_id_idx on public.point_ledger (profile_id);

comment on table public.point_ledger is 'Buku besar poin; amount earn dari approval (task_history_id unik per earn).';

create table public.goal_progress_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  ledger_id uuid not null references public.point_ledger (id) on delete restrict,
  amount int not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index goal_progress_events_profile_id_idx on public.goal_progress_events (profile_id);
create index goal_progress_events_goal_id_idx on public.goal_progress_events (goal_id);

create table public.streaks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  task_category public.task_category not null,
  current_streak int not null default 0,
  best_streak int not null default 0,
  last_completed_date date,
  is_recovery_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, task_category)
);

create index streaks_profile_id_idx on public.streaks (profile_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null,
  recipient_type public.notification_recipient_type not null,
  type text not null,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_type, recipient_id);

-- ---------------------------------------------------------------------------
-- RLS: enable
-- ---------------------------------------------------------------------------

alter table public.tasks enable row level security;
alter table public.task_history enable row level security;
alter table public.point_ledger enable row level security;
alter table public.goal_progress_events enable row level security;
alter table public.streaks enable row level security;
alter table public.notifications enable row level security;

-- tasks: baca anggota keluarga; tulis hanya ortu
create policy "tasks_select_family"
  on public.tasks
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
    )
  );

create policy "tasks_insert_parent"
  on public.tasks
  for insert
  to authenticated
  with check (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

create policy "tasks_update_parent"
  on public.tasks
  for update
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  )
  with check (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

create policy "tasks_delete_parent"
  on public.tasks
  for delete
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

-- task_history: baca keluarga; insert submit (anak/ortu di keluarga); tanpa update/delete dari klien (hanya RPC)
create policy "task_history_select_family"
  on public.task_history
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
    )
  );

create policy "task_history_insert_family"
  on public.task_history
  for insert
  to authenticated
  with check (
    task_id in (select t.id from public.tasks t where t.profile_id = task_history.profile_id)
    and profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
    )
  );

-- point_ledger / goal_progress / streaks: baca saja; tulis hanya lewat function privileged
create policy "point_ledger_select_family"
  on public.point_ledger
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
    )
  );

create policy "goal_progress_select_family"
  on public.goal_progress_events
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
    )
  );

create policy "streaks_select_family"
  on public.streaks
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
    )
  );

create policy "notifications_select_family"
  on public.notifications
  for select
  to authenticated
  using (
    (recipient_type = 'account' and recipient_id = (select auth.uid()))
    or
    (recipient_type = 'profile' and exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
        and c.id = recipient_id
    ))
  );

create policy "notifications_update_read_own"
  on public.notifications
  for update
  to authenticated
  using (
    (recipient_type = 'account' and recipient_id = (select auth.uid()))
    or
    (recipient_type = 'profile' and exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid()) and c.id = recipient_id
    ))
  )
  with check (
    (recipient_type = 'account' and recipient_id = (select auth.uid()))
    or
    (recipient_type = 'profile' and exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid()) and c.id = recipient_id
    ))
  );

-- ---------------------------------------------------------------------------
-- RLS: task_history — policy insert references task_history in with check; fix
-- ---------------------------------------------------------------------------
-- with check for insert cannot reference same-row columns by name in PG < 15 in some cases;
-- use (select profile_id) from tasks join: simpler validate task belongs to profile

drop policy if exists "task_history_insert_family" on public.task_history;

create policy "task_history_insert_family"
  on public.task_history
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.profile_id = task_history.profile_id
    )
    and profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 1.9–1.10 RPC
-- ---------------------------------------------------------------------------

create or replace function public.approve_task_history (p_task_history_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  th public.task_history%rowtype;
  t public.tasks%rowtype;
  g public.goals%rowtype;
  v_family_id uuid;
  v_tz text;
  v_today date;
  v_ledger_id uuid;
  v_amount int;
  v_hp_prev int;
  v_hp_add int;
  v_hp_new int;
  s public.streaks%rowtype;
  v_streak int;
  v_best int;
  v_new_last date;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into th from public.task_history where id = p_task_history_id for update;
  if not found then
    raise exception 'task_history_not_found';
  end if;
  if th.status is distinct from 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  select * into t from public.tasks where id = th.task_id;
  if not found or t.profile_id is distinct from th.profile_id then
    raise exception 'task_mismatch';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = th.profile_id;
  if v_family_id is null then
    raise exception 'profile_not_found';
  end if;

  if not exists (
    select 1
    from public.accounts a
    where a.id = v_user
      and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_amount := t.reward_points;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (th.profile_id, v_user, v_amount, 'earn', p_task_history_id)
  returning id into v_ledger_id;

  select * into g
  from public.goals
  where profile_id = th.profile_id
    and status = 'active'
  order by created_at desc
  limit 1;

  if found then
    v_hp_prev := g.current_hp;
    v_hp_add := least(v_amount, g.target_hp - v_hp_prev);
    if v_hp_add < 0 then
      v_hp_add := 0;
    end if;
    if v_hp_add > 0 then
      insert into public.goal_progress_events (profile_id, goal_id, ledger_id, amount)
      values (th.profile_id, g.id, v_ledger_id, v_hp_add);
      v_hp_new := v_hp_prev + v_hp_add;
      update public.goals
      set
        current_hp = v_hp_new,
        status = case when v_hp_new >= target_hp then 'completed'::public.goal_status else g.status end,
        updated_at = now()
      where id = g.id;
    else
      v_hp_new := v_hp_prev;
    end if;
  end if;

  v_tz := (select f.timezone from public.families f where f.id = v_family_id);
  v_today := (timezone (coalesce(v_tz, 'UTC'), now()))::date;

  select * into s
  from public.streaks
  where profile_id = th.profile_id
    and task_category = t.category
  for update;
  if not found then
    insert into public.streaks (profile_id, task_category, current_streak, best_streak, last_completed_date, updated_at)
    values (th.profile_id, t.category, 1, 1, v_today, now());
  else
    if s.last_completed_date is null then
      v_streak := 1;
    elsif s.last_completed_date = v_today then
      v_streak := s.current_streak;
    elsif s.last_completed_date = v_today - 1 then
      v_streak := s.current_streak + 1;
    else
      v_streak := 1;
    end if;
    v_best := greatest(s.best_streak, v_streak);
    v_new_last := v_today;
    update public.streaks
    set
      current_streak = v_streak,
      best_streak = v_best,
      last_completed_date = v_new_last,
      updated_at = now()
    where id = s.id;
  end if;

  update public.task_history
  set
    status = 'approved',
    approved_by_account_id = v_user,
    approved_at = now()
  where id = p_task_history_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    th.profile_id,
    'profile',
    'task_approved',
    'Misi selesai disetujui. +' || v_amount::text || ' poin.'
  );
end;
$$;

create or replace function public.reject_task_history (p_task_history_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  th public.task_history%rowtype;
  v_family_id uuid;
  r text;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  r := nullif(trim(p_reason), '');
  if r is null then
    raise exception 'rejection_reason_required' using errcode = 'P0001';
  end if;

  select * into th from public.task_history where id = p_task_history_id for update;
  if not found then
    raise exception 'task_history_not_found';
  end if;
  if th.status is distinct from 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = th.profile_id;
  if not exists (
    select 1
    from public.accounts a
    where a.id = v_user
      and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.task_history
  set
    status = 'rejected',
    rejected_by_account_id = v_user,
    rejected_at = now(),
    rejection_reason = r
  where id = p_task_history_id;
end;
$$;

revoke all on function public.approve_task_history (uuid) from public;
revoke all on function public.reject_task_history (uuid, text) from public;
grant execute on function public.approve_task_history (uuid) to authenticated;
grant execute on function public.reject_task_history (uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Validasi bantu submit: jumlah selesai pada periode (hari kalender, timezone keluarga) — Fase 3+ konsumsi
-- ---------------------------------------------------------------------------

create or replace function public.task_submissions_in_period (p_task_id uuid, p_profile_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count int;
  v_family_id uuid;
  v_tz text;
begin
  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = p_profile_id;
  if v_family_id is null then
    return 0;
  end if;
  v_tz := (select f.timezone from public.families f where f.id = v_family_id);
  -- MVP: jumlah submit (pending + approved) pada hari kalender lokal keluarga
  select count(*)::int into v_count
  from public.task_history th
  where th.task_id = p_task_id
    and th.profile_id = p_profile_id
    and th.status in ('pending', 'approved')
    and (timezone (coalesce(v_tz, 'UTC'), th.completed_at))::date
      = (timezone (coalesce(v_tz, 'UTC'), now()))::date;
  return v_count;
end;
$$;

revoke all on function public.task_submissions_in_period (uuid, uuid) from public;
grant execute on function public.task_submissions_in_period (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants tabel
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert on public.task_history to authenticated;
grant select on public.point_ledger to authenticated;
grant select on public.goal_progress_events to authenticated;
grant select on public.streaks to authenticated;
grant select, update on public.notifications to authenticated;
