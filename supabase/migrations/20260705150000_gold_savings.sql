-- Tabung Emas: anak beli/jual emas virtual dengan energi; ortu set harga beli/jual keluarga.

alter type public.ledger_type add value if not exists 'gold_buy';
alter type public.ledger_type add value if not exists 'gold_sell';

create type public.gold_tx_kind as enum ('buy', 'sell');

alter table public.family_settings
  add column if not exists gold_savings_enabled boolean not null default false,
  add column if not exists gold_sell_price_energy int not null default 20,
  add column if not exists gold_buy_price_energy int not null default 18,
  add column if not exists gold_unit_label text not null default 'butir';

alter table public.family_settings
  add constraint family_settings_gold_sell_price_positive
    check (gold_sell_price_energy > 0),
  add constraint family_settings_gold_buy_price_positive
    check (gold_buy_price_energy > 0),
  add constraint family_settings_gold_spread
    check (gold_buy_price_energy < gold_sell_price_energy);

comment on column public.family_settings.gold_sell_price_energy is
  'Harga jual emas keluarga ke anak (energi per butir saat anak beli).';
comment on column public.family_settings.gold_buy_price_energy is
  'Harga beli emas keluarga dari anak (energi per butir saat anak jual).';

create table public.gold_holdings (
  profile_id uuid primary key references public.child_profiles (id) on delete cascade,
  quantity_units int not null default 0 check (quantity_units >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.gold_holdings is
  'Saldo emas virtual per anak (satuan butir).';

create table public.gold_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  kind public.gold_tx_kind not null,
  quantity_units int not null check (quantity_units > 0),
  energy_amount int not null check (energy_amount > 0),
  unit_price_energy int not null check (unit_price_energy > 0),
  ledger_id uuid not null references public.point_ledger (id) on delete restrict,
  created_by_account_id uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index gold_transactions_profile_id_idx
  on public.gold_transactions (profile_id, created_at desc);

comment on table public.gold_transactions is
  'Riwayat beli/jual emas; harga disimpan per transaksi untuk audit.';

alter table public.gold_holdings enable row level security;
alter table public.gold_transactions enable row level security;

create policy gold_holdings_select_family on public.gold_holdings
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = gold_holdings.profile_id
        and a.id = auth.uid()
    )
  );

create policy gold_transactions_select_family on public.gold_transactions
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = gold_transactions.profile_id
        and a.id = auth.uid()
    )
  );

revoke insert, update, delete on public.gold_holdings from public;
revoke insert, update, delete on public.gold_transactions from public;

grant select on public.gold_holdings to authenticated;
grant select on public.gold_transactions to authenticated;

create or replace function public.compute_gold_balance (p_profile_id uuid)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select gh.quantity_units from public.gold_holdings gh where gh.profile_id = p_profile_id),
    0
  )::int;
$$;

revoke all on function public.compute_gold_balance (uuid) from public;
grant execute on function public.compute_gold_balance (uuid) to authenticated;

create or replace function public.update_gold_prices (
  p_sell_price int,
  p_buy_price int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_sell int;
  v_buy int;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select a.family_id into v_family_id
  from public.accounts a
  where a.id = v_user
    and a.role in ('primary_parent', 'secondary_parent');

  if v_family_id is null then
    raise exception 'forbidden';
  end if;

  v_sell := greatest(0, coalesce(p_sell_price, 0));
  v_buy := greatest(0, coalesce(p_buy_price, 0));

  if v_sell < 1 or v_buy < 1 then
    raise exception 'price_required' using errcode = 'P0001';
  end if;

  if v_buy >= v_sell then
    raise exception 'invalid_gold_spread' using errcode = 'P0001';
  end if;

  update public.family_settings
  set
    gold_sell_price_energy = v_sell,
    gold_buy_price_energy = v_buy,
    updated_at = now(),
    updated_by = v_user
  where family_id = v_family_id;

  if not found then
    raise exception 'settings_not_found';
  end if;
end;
$$;

revoke all on function public.update_gold_prices (int, int) from public;
grant execute on function public.update_gold_prices (int, int) to authenticated;

create or replace function public.buy_gold (
  p_profile_id uuid,
  p_quantity_units int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_qty int;
  v_sell_price int;
  v_energy int;
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

  v_qty := greatest(0, coalesce(p_quantity_units, 0));
  if v_qty < 1 then
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

  select fs.gold_sell_price_energy into v_sell_price
  from public.family_settings fs
  where fs.family_id = v_family_id;

  v_energy := v_qty * v_sell_price;

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

  insert into public.gold_holdings (profile_id, quantity_units, updated_at)
  values (p_profile_id, v_qty, now())
  on conflict (profile_id) do update
  set
    quantity_units = gold_holdings.quantity_units + excluded.quantity_units,
    updated_at = now();

  insert into public.gold_transactions (
    profile_id, kind, quantity_units, energy_amount, unit_price_energy,
    ledger_id, created_by_account_id
  )
  values (
    p_profile_id, 'buy', v_qty, v_energy, v_sell_price,
    v_ledger_id, v_user
  )
  returning id into v_tx_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'gold_buy',
    (select name from public.child_profiles where id = p_profile_id)
    || ' membeli ' || v_qty::text || ' butir emas (' || v_energy::text || ' energi).'
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent')
    and a.id <> v_user;

  return v_tx_id;
end;
$$;

revoke all on function public.buy_gold (uuid, int) from public;
grant execute on function public.buy_gold (uuid, int) to authenticated;

create or replace function public.sell_gold (
  p_profile_id uuid,
  p_quantity_units int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_qty int;
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

  v_qty := greatest(0, coalesce(p_quantity_units, 0));
  if v_qty < 1 then
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
  if v_balance < v_qty then
    raise exception 'insufficient_gold' using errcode = 'P0001';
  end if;

  select fs.gold_buy_price_energy into v_buy_price
  from public.family_settings fs
  where fs.family_id = v_family_id;

  v_energy := v_qty * v_buy_price;

  update public.gold_holdings
  set
    quantity_units = quantity_units - v_qty,
    updated_at = now()
  where profile_id = p_profile_id;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (p_profile_id, v_user, v_energy, 'gold_sell', null)
  returning id into v_ledger_id;

  insert into public.gold_transactions (
    profile_id, kind, quantity_units, energy_amount, unit_price_energy,
    ledger_id, created_by_account_id
  )
  values (
    p_profile_id, 'sell', v_qty, v_energy, v_buy_price,
    v_ledger_id, v_user
  )
  returning id into v_tx_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'gold_sell',
    (select name from public.child_profiles where id = p_profile_id)
    || ' menjual ' || v_qty::text || ' butir emas (' || v_energy::text || ' energi).'
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent')
    and a.id <> v_user;

  return v_tx_id;
end;
$$;

revoke all on function public.sell_gold (uuid, int) from public;
grant execute on function public.sell_gold (uuid, int) to authenticated;
