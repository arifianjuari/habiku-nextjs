-- ---------------------------------------------------------------------------
-- Patch goal HP allocators → ready_to_claim
-- ---------------------------------------------------------------------------

create or replace function public.approve_task_history (p_task_history_id uuid, p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  th public.task_history%rowtype;
  t public.tasks%rowtype;
  v_family_id uuid;
  v_tz text;
  v_today date;
  v_ledger_id uuid;
  v_base_amount int;
  v_amount int;
  v_multiplier numeric;
  v_is_featured boolean;
  v_featured_id uuid;
  v_hp_prev int;
  v_hp_add int;
  v_hp_new int;
  v_remaining int;
  g record;
  g_chosen public.goals%rowtype;
  s public.streaks%rowtype;
  v_streak int;
  v_best int;
  v_new_last date;
  v_has_active boolean;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into th from public.task_history where id = p_task_history_id for update;
  if not found then raise exception 'task_history_not_found'; end if;
  if th.status is distinct from 'pending' then raise exception 'not_pending' using errcode = 'P0001'; end if;

  select * into t from public.tasks where id = th.task_id;
  if not found or t.profile_id is distinct from th.profile_id then raise exception 'task_mismatch'; end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = th.profile_id;
  if v_family_id is null then raise exception 'profile_not_found'; end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_tz := (select f.timezone from public.families f where f.id = v_family_id);
  v_today := (timezone(coalesce(v_tz, 'UTC'), now()))::date;

  select task_id into v_featured_id from public.compute_featured_task(th.profile_id, v_today);
  v_is_featured := (v_featured_id is not null and v_featured_id = t.id);
  v_base_amount := t.reward_points;

  if v_is_featured then
    v_multiplier := public._featured_multiplier_value(v_family_id);
    if v_multiplier is null or v_multiplier <= 0 then v_multiplier := 1.0; end if;
    v_amount := floor(v_base_amount::numeric * v_multiplier)::int;
  else
    v_amount := v_base_amount;
  end if;

  select exists (
    select 1 from public.goals where profile_id = th.profile_id and status = 'active'
  ) into v_has_active;

  if p_goal_id is null then
    if v_has_active then raise exception 'goal_required' using errcode = 'P0001'; end if;
  else
    select * into g_chosen from public.goals
    where id = p_goal_id and profile_id = th.profile_id and status = 'active'
    for update;
    if not found then raise exception 'invalid_goal' using errcode = 'P0001'; end if;
  end if;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (th.profile_id, v_user, v_amount, 'earn', p_task_history_id)
  returning id into v_ledger_id;

  v_remaining := v_amount;

  if p_goal_id is not null then
    v_hp_prev := g_chosen.current_hp;
    v_hp_add := least(v_remaining, g_chosen.target_hp - v_hp_prev);
    if v_hp_add < 0 then v_hp_add := 0; end if;
    if v_hp_add > 0 then
      insert into public.goal_progress_events (profile_id, goal_id, ledger_id, amount)
      values (th.profile_id, g_chosen.id, v_ledger_id, v_hp_add);
      v_hp_new := v_hp_prev + v_hp_add;
      update public.goals
      set
        current_hp = v_hp_new,
        status = public.resolve_goal_status_on_hp_reached(g_chosen.status, v_hp_new, g_chosen.target_hp, v_family_id),
        updated_at = now()
      where id = g_chosen.id;
      v_remaining := v_remaining - v_hp_add;
    end if;
  end if;

  for g in
    select * from public.goals
    where profile_id = th.profile_id
      and status = 'active'
      and (p_goal_id is null or id is distinct from p_goal_id)
    order by created_at asc
  loop
    exit when v_remaining <= 0;
    v_hp_prev := g.current_hp;
    v_hp_add := least(v_remaining, g.target_hp - v_hp_prev);
    if v_hp_add < 0 then v_hp_add := 0; end if;
    if v_hp_add > 0 then
      insert into public.goal_progress_events (profile_id, goal_id, ledger_id, amount)
      values (th.profile_id, g.id, v_ledger_id, v_hp_add);
      v_hp_new := v_hp_prev + v_hp_add;
      update public.goals
      set
        current_hp = v_hp_new,
        status = public.resolve_goal_status_on_hp_reached(g.status::public.goal_status, v_hp_new, g.target_hp, v_family_id),
        updated_at = now()
      where id = g.id;
      v_remaining := v_remaining - v_hp_add;
    end if;
  end loop;

  select * into s from public.streaks
  where profile_id = th.profile_id and task_category = t.category
  for update;

  if not found then
    insert into public.streaks (profile_id, task_category, current_streak, best_streak, last_completed_date, updated_at)
    values (th.profile_id, t.category, 1, 1, v_today, now());
  else
    if s.last_completed_date is null then v_streak := 1;
    elsif s.last_completed_date = v_today then v_streak := s.current_streak;
    elsif s.last_completed_date = v_today - 1 then v_streak := s.current_streak + 1;
    else v_streak := 1;
    end if;
    v_best := greatest(s.best_streak, v_streak);
    v_new_last := v_today;
    update public.streaks
    set current_streak = v_streak, best_streak = v_best, last_completed_date = v_new_last, updated_at = now()
    where id = s.id;
  end if;

  update public.task_history
  set status = 'approved', approved_by_account_id = v_user, approved_at = now()
  where id = p_task_history_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    th.profile_id, 'profile', 'task_approved',
    case
      when v_is_featured then
        'Misi sorotan disetujui. +' || v_amount::text || ' poin (sorotan x'
          || trim(trailing '.0' from v_multiplier::text) || ').'
      else 'Misi selesai disetujui. +' || v_amount::text || ' poin.'
    end
  );
end;
$$;

-- give_incidental_reward HP branch (read full function from latest migration and patch status line)
-- transfer_goal_hp destination branch patch

create or replace function public.transfer_goal_hp (
  p_profile_id uuid,
  p_from_goal_id uuid,
  p_to_goal_id uuid,
  p_amount int,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_from public.goals%rowtype;
  v_to public.goals%rowtype;
  v_amount int;
  v_room int;
  v_to_new int;
  v_note text;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  v_amount := greatest(0, coalesce(p_amount, 0));
  if v_amount < 1 then raise exception 'amount_required' using errcode = 'P0001'; end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = p_profile_id;
  if v_family_id is null then raise exception 'profile_not_found'; end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  if p_from_goal_id = p_to_goal_id then
    raise exception 'same_goal' using errcode = 'P0001';
  end if;

  select * into v_from from public.goals
  where id = p_from_goal_id and profile_id = p_profile_id and status = 'active'
  for update;
  if not found then raise exception 'invalid_from_goal' using errcode = 'P0001'; end if;

  select * into v_to from public.goals
  where id = p_to_goal_id and profile_id = p_profile_id and status = 'active'
  for update;
  if not found then raise exception 'invalid_to_goal' using errcode = 'P0001'; end if;

  if v_from.current_hp < v_amount then
    raise exception 'insufficient_hp' using errcode = 'P0001';
  end if;

  v_room := greatest(0, v_to.target_hp - v_to.current_hp);
  if v_amount > v_room then
    raise exception 'destination_full' using errcode = 'P0001';
  end if;

  update public.goals
  set current_hp = current_hp - v_amount, updated_at = now()
  where id = v_from.id;

  v_to_new := v_to.current_hp + v_amount;
  update public.goals
  set
    current_hp = v_to_new,
    status = public.resolve_goal_status_on_hp_reached(v_to.status, v_to_new, v_to.target_hp, v_family_id),
    updated_at = now()
  where id = v_to.id;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 200 then
    v_note := substring(v_note from 1 for 200);
  end if;

  insert into public.goal_hp_transfers (
    profile_id, from_goal_id, to_goal_id, amount, initiated_by_account_id, note
  )
  values (p_profile_id, v_from.id, v_to.id, v_amount, v_user, v_note);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: create_savings_pocket_v2
-- ---------------------------------------------------------------------------

create or replace function public.create_savings_pocket_v2 (
  p_profile_id uuid,
  p_name text,
  p_pocket_type public.savings_pocket_type default 'flexible',
  p_emoji text default '🐷',
  p_accent_color text default '#8B5CF6',
  p_target_amount int default null,
  p_monthly_interest_bps int default 0,
  p_lock_months int default null,
  p_lock_bonus_coefficient numeric default 1.0,
  p_default_for_goal_save boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_name text;
  v_max_bps int;
  v_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  v_name := trim(coalesce(p_name, ''));
  if char_length(v_name) = 0 then raise exception 'name_required' using errcode = 'P0001'; end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = p_profile_id;
  if v_family_id is null then raise exception 'profile_not_found'; end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  if not coalesce((select fs.savings_enabled from public.family_settings fs where fs.family_id = v_family_id), true) then
    raise exception 'savings_disabled' using errcode = 'P0001';
  end if;

  select coalesce(fs.max_monthly_interest_bps, 500) into v_max_bps
  from public.family_settings fs where fs.family_id = v_family_id;

  if coalesce(p_monthly_interest_bps, 0) > v_max_bps then
    raise exception 'interest_rate_too_high' using errcode = 'P0001';
  end if;

  if p_pocket_type = 'term' and (p_lock_months is null or p_lock_months < 1) then
    raise exception 'lock_months_required' using errcode = 'P0001';
  end if;

  if p_default_for_goal_save then
    update public.savings_pockets
    set default_for_goal_save = false
    where profile_id = p_profile_id and default_for_goal_save = true;
  end if;

  insert into public.savings_pockets (
    profile_id, name, emoji, accent_color, target_amount, created_by_account_id,
    pocket_type, monthly_interest_bps, lock_months, lock_bonus_coefficient, default_for_goal_save
  )
  values (
    p_profile_id,
    substring(v_name from 1 for 40),
    coalesce(nullif(trim(p_emoji), ''), '🐷'),
    coalesce(nullif(trim(p_accent_color), ''), '#8B5CF6'),
    case when p_target_amount is not null and p_target_amount > 0 then p_target_amount else null end,
    v_user,
    coalesce(p_pocket_type, 'flexible'),
    greatest(0, coalesce(p_monthly_interest_bps, 0)),
    case when p_pocket_type = 'term' then p_lock_months else null end,
    greatest(0.1, least(5.0, coalesce(p_lock_bonus_coefficient, 1.0))),
    coalesce(p_default_for_goal_save, false)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_savings_pocket_v2 from public;
grant execute on function public.create_savings_pocket_v2 to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: save_goal_hp_to_savings
-- ---------------------------------------------------------------------------

create or replace function public.save_goal_hp_to_savings (
  p_goal_id uuid,
  p_pocket_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_goal public.goals%rowtype;
  v_pocket public.savings_pockets%rowtype;
  v_family_id uuid;
  v_amount int;
  v_locked_until timestamptz;
  v_tx_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_goal from public.goals where id = p_goal_id for update;
  if not found then raise exception 'goal_not_found'; end if;

  if v_goal.status <> 'ready_to_claim' then
    raise exception 'goal_not_ready' using errcode = 'P0001';
  end if;

  v_amount := v_goal.current_hp;
  if v_amount < 1 then raise exception 'no_hp_to_save' using errcode = 'P0001'; end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = v_goal.profile_id;

  if not exists (
    select 1 from public.accounts a where a.id = v_user and a.family_id = v_family_id
  ) then
    raise exception 'forbidden';
  end if;

  if not coalesce((select fs.goal_save_enabled from public.family_settings fs where fs.family_id = v_family_id), true) then
    raise exception 'goal_save_disabled' using errcode = 'P0001';
  end if;

  if p_pocket_id is not null then
    select * into v_pocket from public.savings_pockets
    where id = p_pocket_id and profile_id = v_goal.profile_id and is_active;
  else
    select * into v_pocket from public.savings_pockets
    where profile_id = v_goal.profile_id and is_active and default_for_goal_save = true
    limit 1;
  end if;

  if not found then raise exception 'pocket_not_found' using errcode = 'P0001'; end if;

  if v_pocket.pocket_type = 'term' and public.term_pocket_has_deposit(v_pocket.id) then
    raise exception 'term_pocket_full' using errcode = 'P0001';
  end if;

  if v_pocket.pocket_type = 'term' and v_pocket.lock_months is not null then
    v_locked_until := now() + (v_pocket.lock_months || ' months')::interval;
  end if;

  insert into public.savings_transactions (
    pocket_id, profile_id, kind, amount, requested_by_account_id,
    locked_until, principal_snapshot, ledger_id
  )
  values (
    v_pocket.id, v_goal.profile_id, 'deposit', v_amount, v_user,
    v_locked_until, v_amount, null
  )
  returning id into v_tx_id;

  update public.goals
  set current_hp = 0, status = 'completed', updated_at = now()
  where id = v_goal.id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'goal_saved_to_pocket',
    (select name from public.child_profiles where id = v_goal.profile_id)
    || ' menabung ' || v_amount::text || ' energi dari target «' || v_goal.title
    || '» ke kantong «' || v_pocket.name || '».'
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent');

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    v_goal.profile_id, 'profile', 'goal_saved_to_pocket',
    'Kamu menabung ' || v_amount::text || ' energi ke kantong «' || v_pocket.name || '»! 🎉'
  );

  return v_tx_id;
end;
$$;

revoke all on function public.save_goal_hp_to_savings from public;
grant execute on function public.save_goal_hp_to_savings to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: request / approve / reject goal reward redeem
-- ---------------------------------------------------------------------------

create or replace function public.request_goal_reward_redeem (p_goal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_goal public.goals%rowtype;
  v_family_id uuid;
  v_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_goal from public.goals where id = p_goal_id for update;
  if not found then raise exception 'goal_not_found'; end if;

  if v_goal.status <> 'ready_to_claim' then
    raise exception 'goal_not_ready' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.goal_claim_requests
    where goal_id = p_goal_id and status = 'pending'
  ) then
    raise exception 'claim_already_pending' using errcode = 'P0001';
  end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = v_goal.profile_id;

  if not exists (
    select 1 from public.accounts a where a.id = v_user and a.family_id = v_family_id
  ) then
    raise exception 'forbidden';
  end if;

  insert into public.goal_claim_requests (goal_id, profile_id, requested_by_account_id)
  values (p_goal_id, v_goal.profile_id, v_user)
  returning id into v_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'goal_claim_pending',
    (select name from public.child_profiles where id = v_goal.profile_id)
    || ' ingin mencairkan hadiah «' || v_goal.title || '» (' || v_goal.current_hp::text || ' energi).'
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent');

  return v_id;
end;
$$;

create or replace function public.approve_goal_reward_redeem (p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_req public.goal_claim_requests%rowtype;
  v_goal public.goals%rowtype;
  v_family_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_req from public.goal_claim_requests where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception 'invalid_request';
  end if;

  select * into v_goal from public.goals where id = v_req.goal_id for update;

  select c.family_id into v_family_id from public.child_profiles c where c.id = v_req.profile_id;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  update public.goal_claim_requests
  set status = 'approved', reviewed_by_account_id = v_user, reviewed_at = now()
  where id = p_request_id;

  update public.goals
  set current_hp = 0, status = 'completed', updated_at = now()
  where id = v_goal.id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    v_req.profile_id, 'profile', 'goal_claim_approved',
    'Hadiah «' || v_goal.title || '» disetujui! Selamat menikmati hadiahmu! 🎁'
  );
end;
$$;

create or replace function public.reject_goal_reward_redeem (
  p_request_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_req public.goal_claim_requests%rowtype;
  v_goal public.goals%rowtype;
  v_family_id uuid;
  v_reason text;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_req from public.goal_claim_requests where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception 'invalid_request';
  end if;

  select * into v_goal from public.goals where id = v_req.goal_id;

  select c.family_id into v_family_id from public.child_profiles c where c.id = v_req.profile_id;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  update public.goal_claim_requests
  set status = 'rejected',
      reviewed_by_account_id = v_user,
      reviewed_at = now(),
      reject_reason = v_reason
  where id = p_request_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    v_req.profile_id, 'profile', 'goal_claim_rejected',
    'Permintaan hadiah «' || v_goal.title || '» ditunda.'
      || coalesce(' Catatan: ' || v_reason, '')
      || ' Kamu masih bisa tabung energinya!'
  );
end;
$$;

revoke all on function public.request_goal_reward_redeem from public;
grant execute on function public.request_goal_reward_redeem to authenticated;
revoke all on function public.approve_goal_reward_redeem from public;
grant execute on function public.approve_goal_reward_redeem to authenticated;
revoke all on function public.reject_goal_reward_redeem from public;
grant execute on function public.reject_goal_reward_redeem to authenticated;

-- Block withdraw on locked term pockets
create or replace function public.request_savings_withdraw (
  p_pocket_id uuid,
  p_amount int,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_pocket public.savings_pockets%rowtype;
  v_family_id uuid;
  v_amount int;
  v_available int;
  v_reserved int;
  v_note text;
  v_tx_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  v_amount := greatest(0, coalesce(p_amount, 0));
  if v_amount < 1 then raise exception 'amount_required' using errcode = 'P0001'; end if;

  select * into v_pocket from public.savings_pockets where id = p_pocket_id and is_active;
  if not found then raise exception 'pocket_not_found'; end if;

  if public.pocket_is_locked(p_pocket_id) then
    raise exception 'pocket_locked' using errcode = 'P0001';
  end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = v_pocket.profile_id;

  if not exists (
    select 1 from public.accounts a where a.id = v_user and a.family_id = v_family_id
  ) then
    raise exception 'forbidden';
  end if;

  v_available := public.compute_savings_pocket_balance(p_pocket_id);
  v_reserved := public.compute_savings_reserved_balance(p_pocket_id);
  if v_available - v_reserved < v_amount then
    raise exception 'insufficient_pocket' using errcode = 'P0001';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 200 then
    v_note := substring(v_note from 1 for 200);
  end if;

  insert into public.savings_transactions (
    pocket_id, profile_id, kind, amount, withdraw_status, note, requested_by_account_id
  )
  values (
    p_pocket_id, v_pocket.profile_id, 'withdraw', v_amount, 'pending', v_note, v_user
  )
  returning id into v_tx_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'savings_withdraw_pending',
    (select name from public.child_profiles where id = v_pocket.profile_id)
    || ' mengajukan penarikan ' || v_amount::text || ' dari «' || v_pocket.name || '».'
    || coalesce(' Catatan: ' || v_note, '')
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent');

  return v_tx_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: accrue_savings_interest (cron)
-- ---------------------------------------------------------------------------

create or replace function public.accrue_savings_interest ()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pocket record;
  v_deposit record;
  v_interest int;
  v_effective_bps int;
  v_ledger_id uuid;
  v_count int := 0;
  v_family_interest boolean;
begin
  for v_pocket in
    select p.*, c.family_id
    from public.savings_pockets p
    join public.child_profiles c on c.id = p.profile_id
    where p.is_active and p.monthly_interest_bps > 0
  loop
    select coalesce(fs.savings_interest_enabled, true) into v_family_interest
    from public.family_settings fs where fs.family_id = v_pocket.family_id;

    if not coalesce(v_family_interest, true) then
      continue;
    end if;

    v_effective_bps := floor(
      v_pocket.monthly_interest_bps::numeric * v_pocket.lock_bonus_coefficient
    )::int;

    for v_deposit in
      select t.*
      from public.savings_transactions t
      where t.pocket_id = v_pocket.id
        and t.kind = 'deposit'
        and t.amount > 0
        and (
          v_pocket.pocket_type = 'flexible'
          or (t.locked_until is not null and t.locked_until > now())
        )
        and (t.last_interest_at is null or t.last_interest_at < date_trunc('month', now()))
    loop
      v_interest := floor(v_deposit.amount::numeric * v_effective_bps / 10000)::int;
      if v_interest < 1 then continue; end if;

      insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
      values (v_pocket.profile_id, null, v_interest, 'savings_interest', null)
      returning id into v_ledger_id;

      insert into public.savings_transactions (
        pocket_id, profile_id, kind, amount, ledger_id, requested_by_account_id, last_interest_at
      )
      values (
        v_pocket.id, v_pocket.profile_id, 'interest', v_interest, v_ledger_id, null, now()
      );

      update public.savings_transactions
      set interest_accrued = interest_accrued + v_interest,
          last_interest_at = now()
      where id = v_deposit.id;

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

-- Patch deposit_to_savings: term pocket single deposit + lock metadata
create or replace function public.deposit_to_savings (
  p_pocket_id uuid,
  p_amount int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_pocket public.savings_pockets%rowtype;
  v_family_id uuid;
  v_amount int;
  v_wallet int;
  v_ledger_id uuid;
  v_tx_id uuid;
  v_locked_until timestamptz;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  v_amount := greatest(0, coalesce(p_amount, 0));
  if v_amount < 1 then
    raise exception 'amount_required' using errcode = 'P0001';
  end if;
  if v_amount > 500 then
    v_amount := 500;
  end if;

  select * into v_pocket
  from public.savings_pockets
  where id = p_pocket_id and is_active;
  if not found then
    raise exception 'pocket_not_found';
  end if;

  if v_pocket.pocket_type = 'term' and public.term_pocket_has_deposit(v_pocket.id) then
    raise exception 'term_pocket_full' using errcode = 'P0001';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = v_pocket.profile_id;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
  ) then
    raise exception 'forbidden';
  end if;

  if not coalesce(
    (select fs.savings_enabled from public.family_settings fs where fs.family_id = v_family_id),
    true
  ) then
    raise exception 'savings_disabled' using errcode = 'P0001';
  end if;

  v_wallet := public.compute_wallet_balance(v_pocket.profile_id);
  if v_wallet < v_amount then
    raise exception 'insufficient_wallet' using errcode = 'P0001';
  end if;

  if v_pocket.lock_months is not null and v_pocket.lock_months > 0 then
    v_locked_until := now() + (v_pocket.lock_months || ' months')::interval;
  end if;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (v_pocket.profile_id, v_user, -v_amount, 'savings_deposit', null)
  returning id into v_ledger_id;

  insert into public.savings_transactions (
    pocket_id, profile_id, kind, amount, ledger_id, requested_by_account_id,
    locked_until, principal_snapshot
  )
  values (
    p_pocket_id, v_pocket.profile_id, 'deposit', v_amount, v_ledger_id, v_user,
    v_locked_until, v_amount
  )
  returning id into v_tx_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'savings_deposit',
    (select name from public.child_profiles where id = v_pocket.profile_id)
    || ' menabung ' || v_amount::text || ' energi ke kantong «' || v_pocket.name || '».'
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent')
    and a.id <> v_user;

  return v_tx_id;
end;
$$;

revoke all on function public.deposit_to_savings (uuid, int) from public;
grant execute on function public.deposit_to_savings (uuid, int) to authenticated;

revoke all on function public.accrue_savings_interest from public;
grant execute on function public.accrue_savings_interest to service_role;

grant execute on function public.resolve_goal_status_on_hp_reached to authenticated;
grant execute on function public.pocket_is_locked to authenticated;
grant execute on function public.term_pocket_has_deposit to authenticated;

-- Patch give_incidental_reward → ready_to_claim
create or replace function public.give_incidental_reward (
  p_profile_id uuid,
  p_title text,
  p_note text,
  p_category public.task_category,
  p_hp_to_target int,
  p_energy_only int,
  p_goal_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_title text;
  v_note text;
  v_hp int;
  v_energy int;
  v_goal public.goals%rowtype;
  v_hp_room int;
  v_hp_add int;
  v_hp_new int;
  v_hp_ledger_id uuid;
  v_energy_ledger_id uuid;
  v_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  v_title := trim(coalesce(p_title, ''));
  if char_length(v_title) = 0 then raise exception 'title_required' using errcode = 'P0001'; end if;
  if char_length(v_title) > 80 then v_title := substring(v_title from 1 for 80); end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 200 then
    v_note := substring(v_note from 1 for 200);
  end if;

  v_hp := greatest(0, coalesce(p_hp_to_target, 0));
  v_energy := greatest(0, coalesce(p_energy_only, 0));
  if v_hp = 0 and v_energy = 0 then raise exception 'amount_required' using errcode = 'P0001'; end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = p_profile_id;
  if v_family_id is null then raise exception 'profile_not_found'; end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_hp > 0 then
    if p_goal_id is null then raise exception 'goal_required' using errcode = 'P0001'; end if;
    select * into v_goal from public.goals
    where id = p_goal_id and profile_id = p_profile_id and status = 'active'
    for update;
    if not found then raise exception 'invalid_goal' using errcode = 'P0001'; end if;

    v_hp_room := greatest(0, v_goal.target_hp - v_goal.current_hp);
    v_hp_add := least(v_hp, v_hp_room);
    if v_hp_add > 0 then
      insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
      values (p_profile_id, v_user, v_hp_add, 'earn', null)
      returning id into v_hp_ledger_id;

      insert into public.goal_progress_events (profile_id, goal_id, ledger_id, amount)
      values (p_profile_id, v_goal.id, v_hp_ledger_id, v_hp_add);

      v_hp_new := v_goal.current_hp + v_hp_add;
      update public.goals
      set
        current_hp = v_hp_new,
        status = public.resolve_goal_status_on_hp_reached(v_goal.status, v_hp_new, v_goal.target_hp, v_family_id),
        updated_at = now()
      where id = v_goal.id;
    end if;
  end if;

  if v_energy > 0 then
    insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
    values (p_profile_id, v_user, v_energy, 'earn', null)
    returning id into v_energy_ledger_id;
  end if;

  insert into public.incidental_rewards (
    profile_id, granted_by_account_id, title, note, category,
    hp_to_target, energy_only, goal_id, hp_ledger_id, energy_ledger_id
  )
  values (
    p_profile_id, v_user, v_title, v_note, coalesce(p_category, 'lainnya'),
    v_hp, v_energy,
    case when v_hp > 0 then v_goal.id else null end,
    v_hp_ledger_id, v_energy_ledger_id
  )
  returning id into v_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    p_profile_id, 'profile', 'incidental_reward',
    'Energi insidental: ' || v_title ||
      case when v_hp > 0 then ' · +' || v_hp::text || ' HP target' else '' end ||
      case when v_energy > 0 then ' · +' || v_energy::text || ' energi' else '' end
  );

  return v_id;
end;
$$;
