-- Perbaiki: infinite recursion detected in policy for relation 'accounts'
-- Penyebab: kebijakan RLS pada `accounts` memakai subquery ke `accounts` sendiri;
--            kebijakan lain yang JOIN `accounts` juga memicu evaluasi berulang.
-- Solusi: helper SECURITY DEFINER (bypass RLS sebagai owner) + predikat via child_profiles.family_id.

-- ---------------------------------------------------------------------------
-- Helpers (hanya baris akun pengguna saat ini — aman untuk dipanggil dari policy)
-- ---------------------------------------------------------------------------

create or replace function public.current_family_id ()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id
  from public.accounts
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.current_account_role ()
returns public.account_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.accounts
  where id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_family_id () from public;
grant execute on function public.current_family_id () to authenticated;

revoke all on function public.current_account_role () from public;
grant execute on function public.current_account_role () to authenticated;

comment on function public.current_family_id () is
  'RLS helper: family_id untuk auth.uid(); hindari subquery accounts di policy accounts.';

comment on function public.current_account_role () is
  'RLS helper: role untuk auth.uid(); hindari join accounts di policy lain.';

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------

drop policy if exists "families_select_member" on public.families;
create policy "families_select_member"
  on public.families
  for select
  to authenticated
  using (id = public.current_family_id());

drop policy if exists "families_update_parent" on public.families;
create policy "families_update_parent"
  on public.families
  for update
  to authenticated
  using (
    id = public.current_family_id()
    and public.current_account_role() in ('primary_parent', 'secondary_parent')
  )
  with check (
    id = public.current_family_id()
    and public.current_account_role() in ('primary_parent', 'secondary_parent')
  );

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------

drop policy if exists "accounts_select_family" on public.accounts;
create policy "accounts_select_family"
  on public.accounts
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or family_id = public.current_family_id()
  );

drop policy if exists "accounts_update_self" on public.accounts;
create policy "accounts_update_self"
  on public.accounts
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and family_id = public.current_family_id()
  );

-- ---------------------------------------------------------------------------
-- child_profiles
-- ---------------------------------------------------------------------------

drop policy if exists "child_profiles_select_family" on public.child_profiles;
create policy "child_profiles_select_family"
  on public.child_profiles
  for select
  to authenticated
  using (family_id = public.current_family_id());

drop policy if exists "child_profiles_insert_parent" on public.child_profiles;
create policy "child_profiles_insert_parent"
  on public.child_profiles
  for insert
  to authenticated
  with check (
    family_id = public.current_family_id()
    and public.current_account_role() in ('primary_parent', 'secondary_parent')
  );

drop policy if exists "child_profiles_update_parent" on public.child_profiles;
create policy "child_profiles_update_parent"
  on public.child_profiles
  for update
  to authenticated
  using (
    family_id = public.current_family_id()
    and public.current_account_role() in ('primary_parent', 'secondary_parent')
  )
  with check (
    family_id = public.current_family_id()
    and public.current_account_role() in ('primary_parent', 'secondary_parent')
  );

drop policy if exists "child_profiles_delete_parent" on public.child_profiles;
create policy "child_profiles_delete_parent"
  on public.child_profiles
  for delete
  to authenticated
  using (
    family_id = public.current_family_id()
    and public.current_account_role() in ('primary_parent', 'secondary_parent')
  );

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------

drop policy if exists "goals_select_family" on public.goals;
create policy "goals_select_family"
  on public.goals
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

drop policy if exists "goals_insert_parent" on public.goals;
create policy "goals_insert_parent"
  on public.goals
  for insert
  to authenticated
  with check (
    public.current_account_role() in ('primary_parent', 'secondary_parent')
    and profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

drop policy if exists "goals_update_parent" on public.goals;
create policy "goals_update_parent"
  on public.goals
  for update
  to authenticated
  using (
    public.current_account_role() in ('primary_parent', 'secondary_parent')
    and profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  )
  with check (
    public.current_account_role() in ('primary_parent', 'secondary_parent')
    and profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

drop policy if exists "goals_delete_parent" on public.goals;
create policy "goals_delete_parent"
  on public.goals
  for delete
  to authenticated
  using (
    public.current_account_role() in ('primary_parent', 'secondary_parent')
    and profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

drop policy if exists "tasks_select_family" on public.tasks;
create policy "tasks_select_family"
  on public.tasks
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

drop policy if exists "tasks_insert_parent" on public.tasks;
create policy "tasks_insert_parent"
  on public.tasks
  for insert
  to authenticated
  with check (
    public.current_account_role() in ('primary_parent', 'secondary_parent')
    and profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

drop policy if exists "tasks_update_parent" on public.tasks;
create policy "tasks_update_parent"
  on public.tasks
  for update
  to authenticated
  using (
    public.current_account_role() in ('primary_parent', 'secondary_parent')
    and profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  )
  with check (
    public.current_account_role() in ('primary_parent', 'secondary_parent')
    and profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

drop policy if exists "tasks_delete_parent" on public.tasks;
create policy "tasks_delete_parent"
  on public.tasks
  for delete
  to authenticated
  using (
    public.current_account_role() in ('primary_parent', 'secondary_parent')
    and profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

-- ---------------------------------------------------------------------------
-- task_history
-- ---------------------------------------------------------------------------

drop policy if exists "task_history_select_family" on public.task_history;
create policy "task_history_select_family"
  on public.task_history
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

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
      where c.family_id = public.current_family_id()
    )
  );

-- ---------------------------------------------------------------------------
-- point_ledger, goal_progress_events, streaks
-- ---------------------------------------------------------------------------

drop policy if exists "point_ledger_select_family" on public.point_ledger;
create policy "point_ledger_select_family"
  on public.point_ledger
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

drop policy if exists "goal_progress_select_family" on public.goal_progress_events;
create policy "goal_progress_select_family"
  on public.goal_progress_events
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

drop policy if exists "streaks_select_family" on public.streaks;
create policy "streaks_select_family"
  on public.streaks
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

drop policy if exists "notifications_select_family" on public.notifications;
create policy "notifications_select_family"
  on public.notifications
  for select
  to authenticated
  using (
    (recipient_type = 'account' and recipient_id = (select auth.uid()))
    or (
      recipient_type = 'profile'
      and exists (
        select 1
        from public.child_profiles c
        where c.id = recipient_id
          and c.family_id = public.current_family_id()
      )
    )
  );

drop policy if exists "notifications_update_read_own" on public.notifications;
create policy "notifications_update_read_own"
  on public.notifications
  for update
  to authenticated
  using (
    (recipient_type = 'account' and recipient_id = (select auth.uid()))
    or (
      recipient_type = 'profile'
      and exists (
        select 1
        from public.child_profiles c
        where c.id = recipient_id
          and c.family_id = public.current_family_id()
      )
    )
  )
  with check (
    (recipient_type = 'account' and recipient_id = (select auth.uid()))
    or (
      recipient_type = 'profile'
      and exists (
        select 1
        from public.child_profiles c
        where c.id = recipient_id
          and c.family_id = public.current_family_id()
      )
    )
  );
