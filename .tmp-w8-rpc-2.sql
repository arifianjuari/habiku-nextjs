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