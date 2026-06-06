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