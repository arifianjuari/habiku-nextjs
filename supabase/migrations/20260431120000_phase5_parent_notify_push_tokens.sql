-- Fase 5: notifikasi in-app ke ortu saat misi pending; notifikasi ke profil anak saat tolak;
-- tabel token push per akun ortu; realtime publication untuk notifications.

-- ---------------------------------------------------------------------------
-- Trigger: setelah insert task_history pending → notifikasi tiap akun ortu di keluarga
-- ---------------------------------------------------------------------------

create or replace function public.notify_parents_on_child_task_pending ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_child_name text;
  v_task_title text;
  r record;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  select c.family_id, c.name
    into v_family_id, v_child_name
  from public.child_profiles c
  where c.id = new.profile_id;

  select t.title
    into v_task_title
  from public.tasks t
  where t.id = new.task_id;

  for r in
    select a.id as account_id
    from public.accounts a
    where a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  loop
    insert into public.notifications (recipient_id, recipient_type, type, content)
    values (
      r.account_id,
      'account',
      'task_pending_review',
      coalesce(v_child_name, 'Anak') || ' menunggu tinjauan — ' || coalesce(v_task_title, 'Misi')
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_task_history_notify_parents_pending on public.task_history;

create trigger trg_task_history_notify_parents_pending
  after insert on public.task_history
  for each row
  execute function public.notify_parents_on_child_task_pending ();

comment on function public.notify_parents_on_child_task_pending () is
  'Fase 5: insert notifications (recipient account) saat anak submit misi pending.';

-- ---------------------------------------------------------------------------
-- reject_task_history: beri tahu profil anak (in-app)
-- ---------------------------------------------------------------------------

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
  v_snip text;
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

  v_snip := left(r, 280);
  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    th.profile_id,
    'profile',
    'task_rejected',
    'Misi tidak disetujui: ' || v_snip
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Push tokens (Expo) — hanya akun sendiri via RLS
-- ---------------------------------------------------------------------------

create table if not exists public.account_push_tokens (
  account_id uuid not null references public.accounts (id) on delete cascade,
  expo_push_token text not null,
  platform text,
  updated_at timestamptz not null default now(),
  primary key (account_id)
);

create index if not exists account_push_tokens_updated_idx
  on public.account_push_tokens (updated_at desc);

alter table public.account_push_tokens enable row level security;

drop policy if exists "account_push_tokens_select_own" on public.account_push_tokens;
create policy "account_push_tokens_select_own"
  on public.account_push_tokens
  for select
  to authenticated
  using (account_id = (select auth.uid()));

drop policy if exists "account_push_tokens_upsert_own" on public.account_push_tokens;
create policy "account_push_tokens_upsert_own"
  on public.account_push_tokens
  for insert
  to authenticated
  with check (account_id = (select auth.uid()));

drop policy if exists "account_push_tokens_update_own" on public.account_push_tokens;
create policy "account_push_tokens_update_own"
  on public.account_push_tokens
  for update
  to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

drop policy if exists "account_push_tokens_delete_own" on public.account_push_tokens;
create policy "account_push_tokens_delete_own"
  on public.account_push_tokens
  for delete
  to authenticated
  using (account_id = (select auth.uid()));

grant select, insert, update, delete on public.account_push_tokens to authenticated;

comment on table public.account_push_tokens is
  'Token push Expo per akun ortu (Fase 5); sinkron dari app setelah izin notifikasi.';

-- ---------------------------------------------------------------------------
-- Realtime: notifications untuk invalidasi UI ortu/anak
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
