-- Pecahan emas: 1000 milli = 1 coin. Beli bisa pakai energi (1000 E @ 2000/coin → 500 milli = 0,5 coin).

alter table public.gold_holdings
  add column if not exists quantity_milli int;

update public.gold_holdings
set quantity_milli = quantity_units * 1000
where quantity_milli is null;

alter table public.gold_holdings
  alter column quantity_milli set not null,
  alter column quantity_milli set default 0;

alter table public.gold_holdings
  drop constraint if exists gold_holdings_quantity_units_check;

alter table public.gold_holdings
  drop column if exists quantity_units;

alter table public.gold_holdings
  add constraint gold_holdings_quantity_milli_nonneg check (quantity_milli >= 0);

comment on column public.gold_holdings.quantity_milli is
  'Saldo emas dalam milli-coin (1000 milli = 1 butir).';

alter table public.gold_transactions
  add column if not exists quantity_milli int;

update public.gold_transactions
set quantity_milli = quantity_units * 1000
where quantity_milli is null;

alter table public.gold_transactions
  alter column quantity_milli set not null;

alter table public.gold_transactions
  drop constraint if exists gold_transactions_quantity_units_check;

alter table public.gold_transactions
  drop column if exists quantity_units;

alter table public.gold_transactions
  add constraint gold_transactions_quantity_milli_positive check (quantity_milli > 0);

create or replace function public.compute_gold_balance (p_profile_id uuid)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select gh.quantity_milli from public.gold_holdings gh where gh.profile_id = p_profile_id),
    0
  )::int;
$$;

drop function if exists public.buy_gold (uuid, int);

create or replace function public.buy_gold_with_energy (
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
  v_remaining int;
  v_take int;
  g record;
  v_ledger_id uuid;
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

  v_qty_milli := (v_energy * 1000) / v_sell_price;
  if v_qty_milli < 1 then
    raise exception 'energy_too_low_for_gold' using errcode = 'P0001';
  end if;

  v_savable := public.compute_savable_goal_energy(p_profile_id);
  if v_savable < v_energy then
    raise exception 'insufficient_goal_energy' using errcode = 'P0001';
  end if;

  v_wallet := public.compute_wallet_balance(p_profile_id);
  if v_wallet < v_energy then
    raise exception 'insufficient_wallet' using errcode = 'P0001';
  end if;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (p_profile_id, v_user, -v_energy, 'gold_buy', null)
  returning id into v_ledger_id;

  v_remaining := v_energy;
  for g in
    select *
    from public.goals
    where profile_id = p_profile_id
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
  values (p_profile_id, v_qty_milli, now())
  on conflict (profile_id) do update
  set
    quantity_milli = gold_holdings.quantity_milli + excluded.quantity_milli,
    updated_at = now();

  insert into public.gold_transactions (
    profile_id, kind, quantity_milli, energy_amount, unit_price_energy,
    ledger_id, created_by_account_id
  )
  values (
    p_profile_id, 'buy', v_qty_milli, v_energy, v_sell_price,
    v_ledger_id, v_user
  )
  returning id into v_tx_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'gold_buy',
    (select name from public.child_profiles where id = p_profile_id)
    || ' membeli emas (' || v_qty_milli::text || ' milli, '
    || v_energy::text || ' energi).'
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent')
    and a.id <> v_user;

  return v_tx_id;
end;
$$;

revoke all on function public.buy_gold_with_energy (uuid, int) from public;
grant execute on function public.buy_gold_with_energy (uuid, int) to authenticated;

drop function if exists public.sell_gold (uuid, int);

create or replace function public.sell_gold (
  p_profile_id uuid,
  p_quantity_milli int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_qty_milli int;
  v_buy_price int;
  v_energy int;
  v_balance int;
  v_ledger_id uuid;
  v_tx_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  v_qty_milli := greatest(0, coalesce(p_quantity_milli, 0));
  if v_qty_milli < 1 then
    raise exception 'quantity_required' using errcode = 'P0001';
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

  v_balance := public.compute_gold_balance(p_profile_id);
  if v_balance < v_qty_milli then
    raise exception 'insufficient_gold' using errcode = 'P0001';
  end if;

  select fs.gold_buy_price_energy into v_buy_price
  from public.family_settings fs
  where fs.family_id = v_family_id;

  v_energy := (v_qty_milli * v_buy_price) / 1000;
  if v_energy < 1 then
    raise exception 'quantity_too_small' using errcode = 'P0001';
  end if;

  update public.gold_holdings
  set
    quantity_milli = quantity_milli - v_qty_milli,
    updated_at = now()
  where profile_id = p_profile_id;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (p_profile_id, v_user, v_energy, 'gold_sell', null)
  returning id into v_ledger_id;

  insert into public.gold_transactions (
    profile_id, kind, quantity_milli, energy_amount, unit_price_energy,
    ledger_id, created_by_account_id
  )
  values (
    p_profile_id, 'sell', v_qty_milli, v_energy, v_buy_price,
    v_ledger_id, v_user
  )
  returning id into v_tx_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'gold_sell',
    (select name from public.child_profiles where id = p_profile_id)
    || ' menjual emas (' || v_qty_milli::text || ' milli, '
    || v_energy::text || ' energi).'
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent')
    and a.id <> v_user;

  return v_tx_id;
end;
$$;

revoke all on function public.sell_gold (uuid, int) from public;
grant execute on function public.sell_gold (uuid, int) to authenticated;
