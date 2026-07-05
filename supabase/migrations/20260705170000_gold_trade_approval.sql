-- Beli/jual emas membutuhkan persetujuan ortu (mirip penarikan kantong).

create type public.gold_tx_status as enum ('pending', 'approved', 'rejected');

alter table public.gold_transactions
  add column if not exists status public.gold_tx_status,
  add column if not exists reviewed_by_account_id uuid references public.accounts (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists note text check (note is null or char_length(note) <= 200);

update public.gold_transactions
set status = 'approved'
where status is null;

alter table public.gold_transactions
  alter column status set not null,
  alter column status set default 'pending';

alter table public.gold_transactions
  alter column ledger_id drop not null;

create index if not exists gold_transactions_profile_pending_idx
  on public.gold_transactions (profile_id, created_at desc)
  where status = 'pending';

create or replace function public.compute_gold_reserved_sell_milli (p_profile_id uuid)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(quantity_milli), 0)::int
  from public.gold_transactions
  where profile_id = p_profile_id
    and kind = 'sell'
    and status = 'pending';
$$;

create or replace function public.compute_gold_pending_buy_energy (p_profile_id uuid)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(energy_amount), 0)::int
  from public.gold_transactions
  where profile_id = p_profile_id
    and kind = 'buy'
    and status = 'pending';
$$;

create or replace function public.compute_gold_available_milli (p_profile_id uuid)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select greatest(
    public.compute_gold_balance(p_profile_id) - public.compute_gold_reserved_sell_milli(p_profile_id),
    0
  )::int;
$$;

revoke all on function public.compute_gold_reserved_sell_milli (uuid) from public;
grant execute on function public.compute_gold_reserved_sell_milli (uuid) to authenticated;
revoke all on function public.compute_gold_pending_buy_energy (uuid) from public;
grant execute on function public.compute_gold_pending_buy_energy (uuid) to authenticated;
revoke all on function public.compute_gold_available_milli (uuid) from public;
grant execute on function public.compute_gold_available_milli (uuid) to authenticated;

drop function if exists public.buy_gold_with_energy (uuid, int);
drop function if exists public.sell_gold (uuid, int);

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

create or replace function public.request_gold_sell (
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
  v_available int;
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

  v_available := public.compute_gold_available_milli(p_profile_id);
  if v_available < v_qty_milli then
    raise exception 'insufficient_gold' using errcode = 'P0001';
  end if;

  select fs.gold_buy_price_energy into v_buy_price
  from public.family_settings fs
  where fs.family_id = v_family_id;

  v_energy := (v_qty_milli * v_buy_price) / 1000;
  if v_energy < 1 then
    raise exception 'quantity_too_small' using errcode = 'P0001';
  end if;

  insert into public.gold_transactions (
    profile_id, kind, quantity_milli, energy_amount, unit_price_energy,
    status, created_by_account_id
  )
  values (
    p_profile_id, 'sell', v_qty_milli, v_energy, v_buy_price,
    'pending', v_user
  )
  returning id into v_tx_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'gold_sell_pending',
    (select name from public.child_profiles where id = p_profile_id)
    || ' mengajukan jual emas (' || v_qty_milli::text || ' milli, '
    || v_energy::text || ' energi).'
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent');

  return v_tx_id;
end;
$$;

revoke all on function public.request_gold_sell (uuid, int) from public;
grant execute on function public.request_gold_sell (uuid, int) to authenticated;

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

create or replace function public.reject_gold_transaction (
  p_transaction_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_tx public.gold_transactions%rowtype;
  v_family_id uuid;
  v_reason text;
  v_label text;
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

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is not null and char_length(v_reason) > 200 then
    v_reason := substring(v_reason from 1 for 200);
  end if;

  v_label := case when v_tx.kind = 'buy' then 'Beli emas' else 'Jual emas' end;

  update public.gold_transactions
  set
    status = 'rejected',
    reviewed_by_account_id = v_user,
    reviewed_at = now(),
    note = coalesce(v_reason, note)
  where id = p_transaction_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    v_tx.profile_id,
    'profile',
    case when v_tx.kind = 'buy' then 'gold_buy_rejected' else 'gold_sell_rejected' end,
    v_label || ' ditolak.' || coalesce(' Alasan: ' || v_reason, '')
  );
end;
$$;

revoke all on function public.reject_gold_transaction (uuid, text) from public;
grant execute on function public.reject_gold_transaction (uuid, text) to authenticated;
