-- Hapus plafon buatan 500 energi per setoran.
-- Batas alami: min(saldo dompet, energi di target aktif).

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
  v_savable int;
  v_wallet int;
  v_remaining int;
  v_take int;
  g record;
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

  v_savable := public.compute_savable_goal_energy(v_pocket.profile_id);
  if v_savable < v_amount then
    raise exception 'insufficient_goal_energy' using errcode = 'P0001';
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

  v_remaining := v_amount;
  for g in
    select *
    from public.goals
    where profile_id = v_pocket.profile_id
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
