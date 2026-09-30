-- Perbaikan akrual bunga tabungan/deposito (timing, catch-up, idempotensi)
-- + penarikan overflow HP + guard dompet saat tabung dari target
-- + visibilitas saldo kantong di energy_drift

alter table public.savings_transactions
  add column if not exists accrual_period date;

comment on column public.savings_transactions.accrual_period is
  'Awal bulan kalender yang dibayar bunganya (kind=interest). Idempotensi akrual per kantong+periode.';

create unique index if not exists savings_transactions_interest_period_uidx
  on public.savings_transactions (pocket_id, accrual_period)
  where kind = 'interest' and accrual_period is not null;

-- Backfill periode dari baris bunga lama (approx: bulan sebelum created_at)
update public.savings_transactions t
set accrual_period = (date_trunc('month', t.created_at) - interval '1 month')::date
where t.kind = 'interest'
  and t.accrual_period is null;

-- Saldo kantong pada akhir bulan kalender (basis akrual historis)
create or replace function public.compute_savings_pocket_balance_as_of (
  p_pocket_id uuid,
  p_as_of timestamptz
)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(
    case
      when kind in ('deposit', 'interest') and created_at <= p_as_of then amount
      when kind = 'withdraw'
        and withdraw_status = 'approved'
        and coalesce(reviewed_at, created_at) <= p_as_of then -amount
      else 0
    end
  ), 0)::int
  from public.savings_transactions
  where pocket_id = p_pocket_id;
$$;

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
  v_first_activity timestamptz;
  v_start_period date;
  v_end_period date;
  v_period date;
  v_period_end timestamptz;
  v_ledger_id uuid;
begin
  -- Bulan kalender terakhir yang sudah lengkap (akrual di cron tanggal 1 untuk bulan ini)
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
         and not public.pocket_locked_at(
           v_pocket.id,
           v_period::timestamptz
         ) then
        v_period := (v_period + interval '1 month')::date;
        continue;
      end if;

      v_period_end := (v_period + interval '1 month' - interval '1 microsecond');

      v_balance := public.compute_savings_pocket_balance_as_of(
        v_pocket.id,
        v_period_end
      );

      v_interest := floor(v_balance::numeric * v_effective_bps / 10000)::int;

      if v_interest >= 1 then
        insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
        values (v_pocket.profile_id, null, v_interest, 'savings_interest', null)
        returning id into v_ledger_id;

        insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
        values (v_pocket.profile_id, null, -v_interest, 'savings_deposit', null);

        insert into public.savings_transactions (
          pocket_id,
          profile_id,
          kind,
          amount,
          ledger_id,
          requested_by_account_id,
          last_interest_at,
          accrual_period
        )
        values (
          v_pocket.id,
          v_pocket.profile_id,
          'interest',
          v_interest,
          v_ledger_id,
          null,
          now(),
          v_period
        );

        insert into public.notifications (recipient_id, recipient_type, type, content)
        values (
          v_pocket.profile_id,
          'profile',
          'savings_interest_posted',
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

-- Penarikan: sama seperti allocate_energy_to_goals — overflow ke target aktif terbaru
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
        status = public.resolve_goal_status_on_hp_reached(g.status::public.goal_status, v_hp_new, g.target_hp, v_family_id),
        updated_at = now()
      where id = g.id;
      v_remaining := 0;
    end if;
  end if;

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

revoke all on function public.approve_savings_withdraw from public;
grant execute on function public.approve_savings_withdraw to authenticated;

-- Tabung dari target: cek dompet (cegah dompet minus saat drift historis)
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
  v_wallet int;
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

  v_wallet := public.compute_wallet_balance(v_goal.profile_id);
  if v_wallet < v_amount then
    raise exception 'insufficient_wallet' using errcode = 'P0001';
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

-- Drift: dompet vs goal + energi di kantong tabungan (bunga menambah total kekayaan)
create or replace view public.energy_drift as
select
  c.id                                       as profile_id,
  c.name                                     as child_name,
  public.compute_wallet_balance(c.id)        as wallet_balance,
  public.compute_goal_held_energy(c.id)      as goal_held_energy,
  public.compute_savable_goal_energy(c.id)   as savable_goal_energy,
  public.compute_unallocated_energy(c.id)    as unallocated_energy,
  coalesce((
    select sum(public.compute_savings_pocket_balance(p.id))
    from public.savings_pockets p
    where p.profile_id = c.id and p.is_active
  ), 0)::int                                 as savings_pocket_energy,
  public.compute_wallet_balance(c.id)
    - public.compute_goal_held_energy(c.id)
    - public.compute_unallocated_energy(c.id) as drift
from public.child_profiles c
where c.archived_at is null;

comment on view public.energy_drift is
  'Rekonsiliasi dompet vs energi goal. drift = wallet - goal_held - unallocated (target 0). '
  'savings_pocket_energy = saldo kantong (termasuk bunga); tidak masuk drift karena sudah didebit dari dompet saat setor.';
