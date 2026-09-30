-- Bunga majemuk saat catch-up: bunga yang tercatat terlambat ikut saldo bulan berikutnya.
-- Koreksi selisih catch-up 30 Sep 2026 (tidak pernah mengurangi bunga yang sudah masuk).
-- Jual emas: sisa energi boleh melebihi target, sama seperti penarikan tabungan.
-- Kunci spread: harga beli toko harus lebih rendah dari harga jual toko.

-- ---------------------------------------------------------------------------
-- Akrual: saldo bulan = saldo historis + bunga terlambat yang belum terlihat
-- ---------------------------------------------------------------------------

create or replace function public.accrue_savings_interest ()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pocket record;
  v_balance int;
  v_late_interest int;
  v_interest int;
  v_effective_bps int;
  v_count int := 0;
  v_family_interest boolean;
  v_first_activity timestamptz;
  v_start_period date;
  v_end_period date;
  v_period date;
  v_period_end timestamptz;
  v_ledger_id uuid;
begin
  v_end_period := (date_trunc('month', now()) - interval '1 month')::date;

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

    select max(t.accrual_period) into v_start_period
    from public.savings_transactions t
    where t.pocket_id = v_pocket.id and t.kind = 'interest';

    if v_start_period is not null then
      v_start_period := (v_start_period + interval '1 month')::date;
    else
      select coalesce(
        (
          select min(t.created_at)
          from public.savings_transactions t
          where t.pocket_id = v_pocket.id and t.kind = 'deposit'
        ),
        v_pocket.created_at
      )
      into v_first_activity;

      v_start_period := date_trunc('month', v_first_activity)::date;
    end if;

    if v_start_period is null or v_start_period > v_end_period then
      continue;
    end if;

    v_effective_bps := floor(
      v_pocket.monthly_interest_bps::numeric * v_pocket.lock_bonus_coefficient
    )::int;

    v_period := v_start_period;

    while v_period <= v_end_period loop
      if exists (
        select 1 from public.savings_transactions t
        where t.pocket_id = v_pocket.id
          and t.kind = 'interest'
          and t.accrual_period = v_period
      ) then
        v_period := (v_period + interval '1 month')::date;
        continue;
      end if;

      if v_pocket.pocket_type = 'term'
         and not public.pocket_locked_at(v_pocket.id, v_period::timestamptz) then
        v_period := (v_period + interval '1 month')::date;
        continue;
      end if;

      v_period_end := (v_period + interval '1 month' - interval '1 microsecond');

      select coalesce(sum(t.amount), 0)::int into v_late_interest
      from public.savings_transactions t
      where t.pocket_id = v_pocket.id
        and t.kind = 'interest'
        and t.accrual_period < v_period
        and t.created_at > v_period_end;

      v_balance := public.compute_savings_pocket_balance_as_of(v_pocket.id, v_period_end)
        + v_late_interest;

      v_interest := floor(v_balance::numeric * v_effective_bps / 10000)::int;

      if v_interest >= 1 then
        insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
        values (v_pocket.profile_id, null, v_interest, 'savings_interest', null)
        returning id into v_ledger_id;

        insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
        values (v_pocket.profile_id, null, -v_interest, 'savings_deposit', null);

        insert into public.savings_transactions (
          pocket_id, profile_id, kind, amount, ledger_id,
          requested_by_account_id, last_interest_at, accrual_period
        )
        values (
          v_pocket.id, v_pocket.profile_id, 'interest', v_interest, v_ledger_id,
          null, now(), v_period
        );

        insert into public.notifications (recipient_id, recipient_type, type, content)
        values (
          v_pocket.profile_id, 'profile', 'savings_interest_posted',
          'Bunga ' || v_interest::text || ' energi ('
            || to_char(v_period, 'TMMonth YYYY')
            || ') masuk ke kantong «' || v_pocket.name || '».'
        );

        v_count := v_count + 1;
      end if;

      v_period := (v_period + interval '1 month')::date;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.accrue_savings_interest from public;
grant execute on function public.accrue_savings_interest to service_role;

-- ---------------------------------------------------------------------------
-- Koreksi sekali: naikkan bunga yang sudah ada bila majemuk membuatnya lebih besar.
-- Tidak mengurangi bunga yang sudah dibayarkan.
-- ---------------------------------------------------------------------------

do $$
declare
  v_pocket record;
  v_family_interest boolean;
  v_first_activity timestamptz;
  v_start_period date;
  v_end_period date;
  v_period date;
  v_period_end timestamptz;
  v_effective_bps int;
  v_late_interest int;
  v_balance int;
  v_expected int;
  v_existing int;
  v_delta int;
  v_tx_id uuid;
  v_ledger_id uuid;
  v_pocket_delta int;
begin
  v_end_period := (date_trunc('month', now()) - interval '1 month')::date;

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

    select coalesce(
      (
        select min(t.created_at)
        from public.savings_transactions t
        where t.pocket_id = v_pocket.id and t.kind = 'deposit'
      ),
      v_pocket.created_at
    )
    into v_first_activity;

    v_start_period := date_trunc('month', v_first_activity)::date;
    if v_start_period is null or v_start_period > v_end_period then
      continue;
    end if;

    v_effective_bps := floor(
      v_pocket.monthly_interest_bps::numeric * v_pocket.lock_bonus_coefficient
    )::int;

    v_period := v_start_period;
    v_pocket_delta := 0;

    while v_period <= v_end_period loop
      v_tx_id := null;
      v_existing := 0;

      if v_pocket.pocket_type = 'term'
         and not public.pocket_locked_at(v_pocket.id, v_period::timestamptz) then
        v_period := (v_period + interval '1 month')::date;
        continue;
      end if;

      v_period_end := (v_period + interval '1 month' - interval '1 microsecond');

      select coalesce(sum(t.amount), 0)::int into v_late_interest
      from public.savings_transactions t
      where t.pocket_id = v_pocket.id
        and t.kind = 'interest'
        and t.accrual_period < v_period
        and t.created_at > v_period_end;

      v_balance := public.compute_savings_pocket_balance_as_of(v_pocket.id, v_period_end)
        + v_late_interest;
      v_expected := floor(v_balance::numeric * v_effective_bps / 10000)::int;

      select t.id, t.amount into v_tx_id, v_existing
      from public.savings_transactions t
      where t.pocket_id = v_pocket.id
        and t.kind = 'interest'
        and t.accrual_period = v_period;

      if v_tx_id is null then
        v_existing := 0;
      end if;

      v_delta := v_expected - coalesce(v_existing, 0);

      if v_delta > 0 and v_tx_id is not null then
        update public.savings_transactions
        set amount = v_expected,
            last_interest_at = now()
        where id = v_tx_id;

        insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
        values (v_pocket.profile_id, null, v_delta, 'savings_interest', null);

        insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
        values (v_pocket.profile_id, null, -v_delta, 'savings_deposit', null);

        v_pocket_delta := v_pocket_delta + v_delta;
      elsif v_expected >= 1 and v_tx_id is null then
        insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
        values (v_pocket.profile_id, null, v_expected, 'savings_interest', null)
        returning id into v_ledger_id;

        insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
        values (v_pocket.profile_id, null, -v_expected, 'savings_deposit', null);

        insert into public.savings_transactions (
          pocket_id, profile_id, kind, amount, ledger_id,
          requested_by_account_id, last_interest_at, accrual_period
        )
        values (
          v_pocket.id, v_pocket.profile_id, 'interest', v_expected, v_ledger_id,
          null, now(), v_period
        );

        v_pocket_delta := v_pocket_delta + v_expected;
      end if;

      v_period := (v_period + interval '1 month')::date;
    end loop;

    if v_pocket_delta > 0 then
      insert into public.notifications (recipient_id, recipient_type, type, content)
      values (
        v_pocket.profile_id, 'profile', 'savings_interest_posted',
        'Koreksi bunga majemuk +' || v_pocket_delta::text
          || ' energi masuk ke kantong «' || v_pocket.name || '».'
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Jual emas: overflow ke target aktif terbaru
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
      set current_hp = current_hp - v_take, updated_at = now()
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
    set status = 'approved', ledger_id = v_ledger_id,
        reviewed_by_account_id = v_user, reviewed_at = now()
    where id = p_transaction_id;

    insert into public.notifications (recipient_id, recipient_type, type, content)
    values (
      v_tx.profile_id, 'profile', 'gold_buy_approved',
      'Beli emas disetujui! +' || v_tx.quantity_milli::text || ' milli emas.'
    );

  elsif v_tx.kind = 'sell' then
    if public.compute_gold_balance(v_tx.profile_id) < v_tx.quantity_milli then
      raise exception 'insufficient_gold' using errcode = 'P0001';
    end if;

    if not exists (
      select 1 from public.goals
      where profile_id = v_tx.profile_id and status = 'active'
    ) then
      raise exception 'no_active_goals_for_withdraw' using errcode = 'P0001';
    end if;

    update public.gold_holdings
    set quantity_milli = quantity_milli - v_tx.quantity_milli, updated_at = now()
    where profile_id = v_tx.profile_id;

    insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
    values (v_tx.profile_id, v_user, v_tx.energy_amount, 'gold_sell', null)
    returning id into v_ledger_id;

    v_remaining := v_tx.energy_amount;
    for g in
      select *
      from public.goals
      where profile_id = v_tx.profile_id and status = 'active'
      order by created_at desc
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, greatest(0, g.target_hp - g.current_hp));
      if v_take > 0 then
        v_hp_new := g.current_hp + v_take;
        update public.goals
        set
          current_hp = v_hp_new,
          status = public.resolve_goal_status_on_hp_reached(
            g.status::public.goal_status, v_hp_new, g.target_hp, v_family_id),
          updated_at = now()
        where id = g.id;
        v_remaining := v_remaining - v_take;
      end if;
    end loop;

    if v_remaining > 0 then
      select * into g
      from public.goals
      where profile_id = v_tx.profile_id and status = 'active'
      order by created_at desc
      limit 1
      for update;

      if found then
        v_hp_new := g.current_hp + v_remaining;
        update public.goals
        set
          current_hp = v_hp_new,
          status = public.resolve_goal_status_on_hp_reached(
            g.status::public.goal_status, v_hp_new, g.target_hp, v_family_id),
          updated_at = now()
        where id = g.id;
        v_remaining := 0;
      end if;
    end if;

    if v_remaining > 0 then
      raise exception 'insufficient_goal_capacity' using errcode = 'P0001';
    end if;

    update public.gold_transactions
    set status = 'approved', ledger_id = v_ledger_id,
        reviewed_by_account_id = v_user, reviewed_at = now()
    where id = p_transaction_id;

    insert into public.notifications (recipient_id, recipient_type, type, content)
    values (
      v_tx.profile_id, 'profile', 'gold_sell_approved',
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
-- Spread emas: harga saat anak menjual harus lebih rendah dari harga saat anak membeli
-- ---------------------------------------------------------------------------

alter table public.family_settings
  drop constraint if exists family_settings_gold_spread;

alter table public.family_settings
  add constraint family_settings_gold_spread
  check (gold_buy_price_energy < gold_sell_price_energy);
