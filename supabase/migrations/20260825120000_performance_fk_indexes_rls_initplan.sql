-- Performance hygiene (F11): covering indexes for FK columns + RLS auth initplan fix.
-- Ref: docs/performance-diagnosis.md, Supabase advisors unindexed_foreign_keys + auth_rls_initplan.

-- ---------------------------------------------------------------------------
-- Foreign key covering indexes
-- ---------------------------------------------------------------------------
create index if not exists daily_check_ins_ledger_id_idx
  on public.daily_check_ins (ledger_id);

create index if not exists family_invites_created_by_idx
  on public.family_invites (created_by);

create index if not exists family_settings_updated_by_idx
  on public.family_settings (updated_by);

create index if not exists goal_claim_requests_requested_by_account_id_idx
  on public.goal_claim_requests (requested_by_account_id);

create index if not exists goal_claim_requests_reviewed_by_account_id_idx
  on public.goal_claim_requests (reviewed_by_account_id);

create index if not exists goal_hp_transfers_from_goal_id_idx
  on public.goal_hp_transfers (from_goal_id);

create index if not exists goal_hp_transfers_to_goal_id_idx
  on public.goal_hp_transfers (to_goal_id);

create index if not exists goal_hp_transfers_initiated_by_account_id_idx
  on public.goal_hp_transfers (initiated_by_account_id);

create index if not exists goal_progress_events_ledger_id_idx
  on public.goal_progress_events (ledger_id);

create index if not exists goal_requests_created_goal_id_idx
  on public.goal_requests (created_goal_id);

create index if not exists goal_requests_reviewed_by_idx
  on public.goal_requests (reviewed_by);

create index if not exists gold_transactions_ledger_id_idx
  on public.gold_transactions (ledger_id);

create index if not exists gold_transactions_created_by_account_id_idx
  on public.gold_transactions (created_by_account_id);

create index if not exists gold_transactions_reviewed_by_account_id_idx
  on public.gold_transactions (reviewed_by_account_id);

create index if not exists incidental_rewards_granted_by_account_id_idx
  on public.incidental_rewards (granted_by_account_id);

create index if not exists incidental_rewards_hp_ledger_id_idx
  on public.incidental_rewards (hp_ledger_id);

create index if not exists incidental_rewards_energy_ledger_id_idx
  on public.incidental_rewards (energy_ledger_id);

create index if not exists learning_tips_created_by_idx
  on public.learning_tips (created_by);

create index if not exists point_ledger_account_id_idx
  on public.point_ledger (account_id);

create index if not exists savings_pockets_created_by_account_id_idx
  on public.savings_pockets (created_by_account_id);

create index if not exists savings_transactions_ledger_id_idx
  on public.savings_transactions (ledger_id);

create index if not exists savings_transactions_requested_by_account_id_idx
  on public.savings_transactions (requested_by_account_id);

create index if not exists savings_transactions_reviewed_by_account_id_idx
  on public.savings_transactions (reviewed_by_account_id);

create index if not exists task_history_approved_by_account_id_idx
  on public.task_history (approved_by_account_id);

create index if not exists task_history_rejected_by_account_id_idx
  on public.task_history (rejected_by_account_id);

create index if not exists task_requests_created_task_id_idx
  on public.task_requests (created_task_id);

create index if not exists task_requests_reviewed_by_idx
  on public.task_requests (reviewed_by);

-- ---------------------------------------------------------------------------
-- RLS: wrap auth.uid() as (select auth.uid()) for initplan caching
-- ---------------------------------------------------------------------------

drop policy if exists child_badges_select_family on public.child_badges;
create policy child_badges_select_family on public.child_badges
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = child_badges.profile_id
        and a.id = (select auth.uid())
    )
    or exists (
      select 1
      from public.child_profiles c
      where c.id = child_badges.profile_id
        and c.id = (select auth.uid())
    )
  );

drop policy if exists child_reflections_select_family on public.child_daily_reflections;
create policy child_reflections_select_family on public.child_daily_reflections
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = child_daily_reflections.profile_id
        and a.id = (select auth.uid())
    )
    or exists (
      select 1
      from public.child_profiles c
      where c.id = child_daily_reflections.profile_id
        and c.id = (select auth.uid())
    )
  );

drop policy if exists daily_check_ins_select_family on public.daily_check_ins;
create policy daily_check_ins_select_family on public.daily_check_ins
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = daily_check_ins.profile_id
        and a.id = (select auth.uid())
    )
  );

drop policy if exists family_settings_select_parent on public.family_settings;
create policy family_settings_select_parent on public.family_settings
  for select to authenticated
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = (select auth.uid())
        and a.family_id = family_settings.family_id
        and a.role = any (array['primary_parent'::public.account_role, 'secondary_parent'::public.account_role])
    )
  );

drop policy if exists family_settings_update_parent on public.family_settings;
create policy family_settings_update_parent on public.family_settings
  for update to authenticated
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = (select auth.uid())
        and a.family_id = family_settings.family_id
        and a.role = any (array['primary_parent'::public.account_role, 'secondary_parent'::public.account_role])
    )
  )
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = (select auth.uid())
        and a.family_id = family_settings.family_id
        and a.role = any (array['primary_parent'::public.account_role, 'secondary_parent'::public.account_role])
    )
  );

drop policy if exists goal_claim_requests_select_family on public.goal_claim_requests;
create policy goal_claim_requests_select_family on public.goal_claim_requests
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = goal_claim_requests.profile_id
        and a.id = (select auth.uid())
    )
  );

drop policy if exists goal_hp_transfers_select_family on public.goal_hp_transfers;
create policy goal_hp_transfers_select_family on public.goal_hp_transfers
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = goal_hp_transfers.profile_id
        and a.id = (select auth.uid())
    )
  );

drop policy if exists gold_holdings_select_family on public.gold_holdings;
create policy gold_holdings_select_family on public.gold_holdings
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = gold_holdings.profile_id
        and a.id = (select auth.uid())
    )
  );

drop policy if exists gold_transactions_select_family on public.gold_transactions;
create policy gold_transactions_select_family on public.gold_transactions
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = gold_transactions.profile_id
        and a.id = (select auth.uid())
    )
  );

drop policy if exists incidental_rewards_select_family on public.incidental_rewards;
create policy incidental_rewards_select_family on public.incidental_rewards
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = incidental_rewards.profile_id
        and a.id = (select auth.uid())
    )
  );

drop policy if exists learning_tips_select_family on public.learning_tips;
create policy learning_tips_select_family on public.learning_tips
  for select to authenticated
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = (select auth.uid())
        and a.family_id = learning_tips.family_id
    )
    or exists (
      select 1
      from public.child_profiles c
      where c.id = (select auth.uid())
        and c.family_id = learning_tips.family_id
    )
  );

drop policy if exists learning_tips_insert_parent on public.learning_tips;
create policy learning_tips_insert_parent on public.learning_tips
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = (select auth.uid())
        and a.family_id = learning_tips.family_id
        and a.role = any (array['primary_parent'::public.account_role, 'secondary_parent'::public.account_role])
    )
  );

drop policy if exists learning_tips_update_parent on public.learning_tips;
create policy learning_tips_update_parent on public.learning_tips
  for update to authenticated
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = (select auth.uid())
        and a.family_id = learning_tips.family_id
        and a.role = any (array['primary_parent'::public.account_role, 'secondary_parent'::public.account_role])
    )
  )
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = (select auth.uid())
        and a.family_id = learning_tips.family_id
        and a.role = any (array['primary_parent'::public.account_role, 'secondary_parent'::public.account_role])
    )
  );

drop policy if exists learning_tips_delete_parent on public.learning_tips;
create policy learning_tips_delete_parent on public.learning_tips
  for delete to authenticated
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = (select auth.uid())
        and a.family_id = learning_tips.family_id
        and a.role = any (array['primary_parent'::public.account_role, 'secondary_parent'::public.account_role])
    )
  );

drop policy if exists savings_pockets_select_family on public.savings_pockets;
create policy savings_pockets_select_family on public.savings_pockets
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = savings_pockets.profile_id
        and a.id = (select auth.uid())
    )
  );

drop policy if exists savings_transactions_select_family on public.savings_transactions;
create policy savings_transactions_select_family on public.savings_transactions
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = savings_transactions.profile_id
        and a.id = (select auth.uid())
    )
  );
