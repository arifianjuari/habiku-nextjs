-- Integritas akuntansi tabungan (docs/savings-diagnosis.md)
-- Melanjutkan 20260714120000_savings_ledger_integrity.sql + temuan T1,T5–T9,T12–T14.

-- ---------------------------------------------------------------------------
-- Alat ukur drift energi (butir 1)
-- ---------------------------------------------------------------------------

create or replace view public.energy_drift as
select
  c.id as profile_id,
  c.name,
  public.compute_wallet_balance(c.id) as wallet_balance,
  public.compute_savable_goal_energy(c.id) as savable_goal_energy,
  public.compute_wallet_balance(c.id) - public.compute_savable_goal_energy(c.id) as drift
from public.child_profiles c
where c.archived_at is null;

comment on view public.energy_drift is
  'Rekonsiliasi dompet vs energi goal aktif; target drift = 0 setelah perbaikan.';

-- ---------------------------------------------------------------------------
-- Constraint DB: harga emas > 0, plafon bunga (T13, T14)
-- ---------------------------------------------------------------------------

alter table public.family_settings
  drop constraint if exists family_settings_gold_sell_price_positive;

alter table public.family_settings
  add constraint family_settings_gold_sell_price_positive
  check (gold_sell_price_energy > 0);

alter table public.family_settings
  drop constraint if exists family_settings_gold_buy_price_positive;

alter table public.family_settings
  add constraint family_settings_gold_buy_price_positive
  check (gold_buy_price_energy > 0);

alter table public.family_settings
  drop constraint if exists family_settings_max_monthly_interest_bps_cap;

alter table public.family_settings
  add constraint family_settings_max_monthly_interest_bps_cap
  check (max_monthly_interest_bps <= 2000);

alter table public.savings_pockets
  drop constraint if exists savings_pockets_monthly_interest_bps_cap;

alter table public.savings_pockets
  add constraint savings_pockets_monthly_interest_bps_cap
  check (monthly_interest_bps <= 2000);

-- ---------------------------------------------------------------------------
-- T9: deposito roll-over — hanya blok bila masih ada saldo atau kunci aktif
-- ---------------------------------------------------------------------------

create or replace function public.term_pocket_has_deposit (p_pocket_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.compute_savings_pocket_balance(p_pocket_id) > 0
  or exists (
    select 1
    from public.savings_transactions t
    where t.pocket_id = p_pocket_id
      and t.kind = 'deposit'
      and t.locked_until is not null
      and t.locked_until > now()
  );
$$;

-- ---------------------------------------------------------------------------
-- T5/T6: akrual bunga — tanpa kredit ganda ke dompet + catch-up bulan terlewat
-- ---------------------------------------------------------------------------

alter table public.savings_transactions
  drop constraint if exists savings_transactions_check;

alter table public.savings_transactions
  add constraint savings_transactions_check check (
    (kind = 'deposit' and withdraw_status is null)
    or (kind = 'withdraw' and withdraw_status is not null)
    or (kind = 'interest' and withdraw_status is null)
  );

create or replace function public.accrue_savings_interest ()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pocket record;
  v_balance int;
  v_interest int;
  v_effective_bps int;
  v_count int := 0;
  v_family_interest boolean;
  v_last_interest timestamptz;
  v_period_month timestamptz;
  v_target_month timestamptz;
begin
  v_target_month := date_trunc('month', now());

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

    select max(t.created_at) into v_last_interest
    from public.savings_transactions t
    where t.pocket_id = v_pocket.id and t.kind = 'interest';

    if v_last_interest is null then
      select min(t.created_at) into v_last_interest
      from public.savings_transactions t
      where t.pocket_id = v_pocket.id and t.kind = 'deposit';
    end if;

    if v_last_interest is null then
      v_last_interest := v_pocket.created_at;
    end if;

    v_period_month := date_trunc('month', v_last_interest);

    v_effective_bps := floor(
      v_pocket.monthly_interest_bps::numeric * v_pocket.lock_bonus_coefficient
    )::int;

    while v_period_month < v_target_month loop
      v_period_month := v_period_month + interval '1 month';

      if exists (
        select 1 from public.savings_transactions t
        where t.pocket_id = v_pocket.id
          and t.kind = 'interest'
          and t.created_at >= v_period_month
          and t.created_at < v_period_month + interval '1 month'
      ) then
        continue;
      end if;

      if v_pocket.pocket_type = 'term' and not public.pocket_is_locked(v_pocket.id) then
        continue;
      end if;

      v_balance := public.compute_savings_pocket_balance(v_pocket.id);
      v_interest := floor(v_balance::numeric * v_effective_bps / 10000)::int;
      if v_interest < 1 then
        continue;
      end if;

      insert into public.savings_transactions (
        pocket_id, profile_id, kind, amount, ledger_id, requested_by_account_id, last_interest_at
      )
      values (v_pocket.id, v_pocket.profile_id, 'interest', v_interest, null, null, now());

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.accrue_savings_interest from public;
grant execute on function public.accrue_savings_interest to service_role;

-- ---------------------------------------------------------------------------
-- T1: approve_goal_reward_redeem — debit dompet (goal_redeem_spend)
-- ---------------------------------------------------------------------------

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
  v_amount int;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_req from public.goal_claim_requests where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception 'invalid_request';
  end if;

  select * into v_goal from public.goals where id = v_req.goal_id for update;

  if not found or v_goal.status <> 'ready_to_claim' or v_goal.current_hp < 1 then
    raise exception 'goal_not_ready' using errcode = 'P0001';
  end if;

  v_amount := v_goal.current_hp;

  select c.family_id into v_family_id from public.child_profiles c where c.id = v_req.profile_id;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (v_req.profile_id, v_user, -v_amount, 'goal_redeem_spend', null);

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

revoke all on function public.approve_goal_reward_redeem from public;
grant execute on function public.approve_goal_reward_redeem to authenticated;

-- ---------------------------------------------------------------------------
-- T2: save_goal_hp_to_savings — debit dompet (savings_deposit)
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
  v_ledger_id uuid;
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

  update public.goal_claim_requests
  set status = 'rejected',
      reviewed_by_account_id = v_user,
      reviewed_at = now(),
      reject_reason = 'Dibatalkan otomatis: energi target sudah ditabung ke kantong.'
  where goal_id = v_goal.id and status = 'pending';

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (v_goal.profile_id, v_user, -v_amount, 'savings_deposit', null)
  returning id into v_ledger_id;

  insert into public.savings_transactions (
    pocket_id, profile_id, kind, amount, requested_by_account_id,
    locked_until, principal_snapshot, ledger_id
  )
  values (
    v_pocket.id, v_goal.profile_id, 'deposit', v_amount, v_user,
    v_locked_until, v_amount, v_ledger_id
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
-- T7: approve_savings_withdraw — alokasi HP wajib penuh sebelum kredit dompet
-- ---------------------------------------------------------------------------

create or replace function public.approve_savings_withdraw (p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_tx public.savings_transactions%rowtype;
  v_pocket public.savings_pockets%rowtype;
  v_family_id uuid;
  v_balance int;
  v_ledger_id uuid;
  v_remaining int;
  v_take int;
  v_hp_new int;
  g record;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_tx
  from public.savings_transactions
  where id = p_transaction_id
  for update;
  if not found or v_tx.kind <> 'withdraw' or v_tx.withdraw_status <> 'pending' then
    raise exception 'invalid_transaction';
  end if;

  select * into v_pocket from public.savings_pockets where id = v_tx.pocket_id;

  select c.family_id into v_family_id
  from public.child_profiles c where c.id = v_tx.profile_id;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user
      and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  v_balance := public.compute_savings_pocket_balance(v_tx.pocket_id);
  if v_balance < v_tx.amount then
    raise exception 'insufficient_pocket' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.goals
    where profile_id = v_tx.profile_id and status = 'active'
  ) then
    raise exception 'no_active_goals_for_withdraw' using errcode = 'P0001';
  end if;

  v_remaining := v_tx.amount;
  for g in
    select *
    from public.goals
    where profile_id = v_tx.profile_id
      and status = 'active'
    order by created_at desc
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, greatest(0, g.target_hp - g.current_hp));
    if v_take > 0 then
      v_hp_new := g.current_hp + v_take;
      update public.goals
      set
        current_hp = v_hp_new,
        status = public.resolve_goal_status_on_hp_reached(g.status::public.goal_status, v_hp_new, g.target_hp, v_family_id),
        updated_at = now()
      where id = g.id;
      v_remaining := v_remaining - v_take;
    end if;
  end loop;

  if v_remaining > 0 then
    raise exception 'insufficient_goal_capacity' using errcode = 'P0001';
  end if;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (v_tx.profile_id, v_user, v_tx.amount, 'savings_withdraw', null)
  returning id into v_ledger_id;

  update public.savings_transactions
  set withdraw_status = 'approved',
      ledger_id = v_ledger_id,
      reviewed_by_account_id = v_user,
      reviewed_at = now()
  where id = p_transaction_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    v_tx.profile_id,
    'profile',
    'savings_withdraw_approved',
    'Penarikan ' || v_tx.amount::text || ' dari kantong «' || v_pocket.name
      || '» disetujui! Energi kembali ke dompet dan target aktifmu.'
  );
end;
$$;

revoke all on function public.approve_savings_withdraw (uuid) from public;
grant execute on function public.approve_savings_withdraw (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- T3/T12: approve_gold_transaction — simetri jual + kedaluwarsa 7 hari
-- ---------------------------------------------------------------------------

create or replace function public.approve_gold_transaction (p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_tx public.gold_transactions%rowtype;
  v_family_id uuid;
  v_savable int;
  v_wallet int;
  v_pending_buy int;
  v_remaining int;
  v_take int;
  v_hp_new int;
  g record;
  v_ledger_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_tx
  from public.gold_transactions
  where id = p_transaction_id
  for update;

  if not found or v_tx.status <> 'pending' then
    raise exception 'invalid_transaction';
  end if;

  if v_tx.created_at < now() - interval '7 days' then
    raise exception 'gold_request_expired' using errcode = 'P0001';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = v_tx.profile_id;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user
      and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  if v_tx.kind = 'buy' then
    v_pending_buy := public.compute_gold_pending_buy_energy(v_tx.profile_id) - v_tx.energy_amount;
    v_savable := public.compute_savable_goal_energy(v_tx.profile_id);
    if v_savable < v_tx.energy_amount + v_pending_buy then
      raise exception 'insufficient_goal_energy' using errcode = 'P0001';
    end if;

    v_wallet := public.compute_wallet_balance(v_tx.profile_id);
    if v_wallet < v_tx.energy_amount + v_pending_buy then
      raise exception 'insufficient_wallet' using errcode = 'P0001';
    end if;

    insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
    values (v_tx.profile_id, v_user, -v_tx.energy_amount, 'gold_buy', null)
    returning id into v_ledger_id;

    v_remaining := v_tx.energy_amount;
    for g in
      select *
      from public.goals
      where profile_id = v_tx.profile_id
        and status = 'active'
        and current_hp > 0
      order by created_at desc
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, g.current_hp);
      update public.goals
      set
        current_hp = current_hp - v_take,
        updated_at = now()
      where id = g.id;
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception 'insufficient_goal_energy' using errcode = 'P0001';
    end if;

    insert into public.gold_holdings (profile_id, quantity_milli, updated_at)
    values (v_tx.profile_id, v_tx.quantity_milli, now())
    on conflict (profile_id) do update
    set
      quantity_milli = gold_holdings.quantity_milli + excluded.quantity_milli,
      updated_at = now();

    update public.gold_transactions
    set
      status = 'approved',
      ledger_id = v_ledger_id,
      reviewed_by_account_id = v_user,
      reviewed_at = now()
    where id = p_transaction_id;

    insert into public.notifications (recipient_id, recipient_type, type, content)
    values (
      v_tx.profile_id,
      'profile',
      'gold_buy_approved',
      'Beli emas disetujui! +' || v_tx.quantity_milli::text || ' milli emas.'
    );

  elsif v_tx.kind = 'sell' then
    if public.compute_gold_balance(v_tx.profile_id) < v_tx.quantity_milli then
      raise exception 'insufficient_gold' using errcode = 'P0001';
    end if;

    update public.gold_holdings
    set
      quantity_milli = quantity_milli - v_tx.quantity_milli,
      updated_at = now()
    where profile_id = v_tx.profile_id;

    insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
    values (v_tx.profile_id, v_user, v_tx.energy_amount, 'gold_sell', null)
    returning id into v_ledger_id;

    v_remaining := v_tx.energy_amount;
    for g in
      select *
      from public.goals
      where profile_id = v_tx.profile_id
        and status = 'active'
      order by created_at desc
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, greatest(0, g.target_hp - g.current_hp));
      if v_take > 0 then
        v_hp_new := g.current_hp + v_take;
        update public.goals
        set
          current_hp = v_hp_new,
          status = public.resolve_goal_status_on_hp_reached(g.status::public.goal_status, v_hp_new, g.target_hp, v_family_id),
          updated_at = now()
        where id = g.id;
        v_remaining := v_remaining - v_take;
      end if;
    end loop;

    if v_remaining > 0 then
      raise exception 'insufficient_goal_capacity' using errcode = 'P0001';
    end if;

    update public.gold_transactions
    set
      status = 'approved',
      ledger_id = v_ledger_id,
      reviewed_by_account_id = v_user,
      reviewed_at = now()
    where id = p_transaction_id;

    insert into public.notifications (recipient_id, recipient_type, type, content)
    values (
      v_tx.profile_id,
      'profile',
      'gold_sell_approved',
      'Jual emas disetujui! +' || v_tx.energy_amount::text || ' energi masuk dompet.'
    );
  else
    raise exception 'invalid_transaction';
  end if;
end;
$$;

revoke all on function public.approve_gold_transaction (uuid) from public;
grant execute on function public.approve_gold_transaction (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- T12/T13: request_gold_buy — cek harga valid
-- ---------------------------------------------------------------------------

create or replace function public.request_gold_buy (
  p_profile_id uuid,
  p_energy_amount int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_energy int;
  v_sell_price int;
  v_qty_milli int;
  v_savable int;
  v_wallet int;
  v_pending_buy int;
  v_tx_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  v_energy := greatest(0, coalesce(p_energy_amount, 0));
  if v_energy < 1 then
    raise exception 'amount_required' using errcode = 'P0001';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = p_profile_id;

  if v_family_id is null then
    raise exception 'profile_not_found';
  end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
  ) then
    raise exception 'forbidden';
  end if;

  if not coalesce(
    (select fs.gold_savings_enabled from public.family_settings fs where fs.family_id = v_family_id),
    false
  ) then
    raise exception 'gold_savings_disabled' using errcode = 'P0001';
  end if;

  select fs.gold_sell_price_energy into v_sell_price
  from public.family_settings fs
  where fs.family_id = v_family_id;

  if coalesce(v_sell_price, 0) < 1 then
    raise exception 'gold_price_not_configured' using errcode = 'P0001';
  end if;

  v_qty_milli := (v_energy * 1000) / v_sell_price;
  if v_qty_milli < 1 then
    raise exception 'energy_too_low_for_gold' using errcode = 'P0001';
  end if;

  v_pending_buy := public.compute_gold_pending_buy_energy(p_profile_id);
  v_savable := public.compute_savable_goal_energy(p_profile_id);
  if v_savable < v_energy + v_pending_buy then
    raise exception 'insufficient_goal_energy' using errcode = 'P0001';
  end if;

  v_wallet := public.compute_wallet_balance(p_profile_id);
  if v_wallet < v_energy + v_pending_buy then
    raise exception 'insufficient_wallet' using errcode = 'P0001';
  end if;

  insert into public.gold_transactions (
    profile_id, kind, quantity_milli, energy_amount, unit_price_energy,
    status, created_by_account_id
  )
  values (
    p_profile_id, 'buy', v_qty_milli, v_energy, v_sell_price,
    'pending', v_user
  )
  returning id into v_tx_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'gold_buy_pending',
    (select name from public.child_profiles where id = p_profile_id)
    || ' mengajukan beli emas (' || v_qty_milli::text || ' milli, '
    || v_energy::text || ' energi).'
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent');

  return v_tx_id;
end;
$$;

revoke all on function public.request_gold_buy (uuid, int) from public;
grant execute on function public.request_gold_buy (uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Koreksi data historis
-- ---------------------------------------------------------------------------

-- Balikkan kredit dompet ganda dari akrual bunga lama (jika ada).
insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
select pl.profile_id, null, -pl.amount, 'savings_interest', null
from public.point_ledger pl
where pl.type = 'savings_interest'
  and pl.amount > 0
  and exists (
    select 1 from public.savings_transactions st
    where st.ledger_id = pl.id and st.kind = 'interest'
  );

-- Backfill debit dompet untuk setoran tanpa ledger.
do $$
declare
  r record;
  v_ledger_id uuid;
begin
  for r in
    select id, profile_id, amount, requested_by_account_id
    from public.savings_transactions
    where kind = 'deposit' and ledger_id is null
  loop
    insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
    values (r.profile_id, r.requested_by_account_id, -r.amount, 'savings_deposit', null)
    returning id into v_ledger_id;

    update public.savings_transactions
    set ledger_id = v_ledger_id
    where id = r.id;
  end loop;
end;
$$;

-- T1 historis: backfill goal_redeem_spend untuk klaim hadiah yang sudah disetujui.
insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
select gcr.profile_id, gcr.reviewed_by_account_id, -g.target_hp, 'goal_redeem_spend', null
from public.goal_claim_requests gcr
join public.goals g on g.id = gcr.goal_id
where gcr.status = 'approved'
  and g.target_hp > 0
  and not exists (
    select 1 from public.point_ledger pl
    where pl.profile_id = gcr.profile_id
      and pl.type = 'goal_redeem_spend'
      and pl.amount = -g.target_hp
  );

-- T8: normalkan HP terdampar di goal selesai.
update public.goals
set current_hp = 0, updated_at = now()
where status = 'completed' and current_hp > 0;
