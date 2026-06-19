-- Hapus (arsipkan) kantong tabungan kosong + kembalikan HP target saat penarikan disetujui

-- ---------------------------------------------------------------------------
-- RPC: delete_savings_pocket — ortu arsipkan kantong/deposito yang sudah kosong
-- ---------------------------------------------------------------------------

create or replace function public.delete_savings_pocket (p_pocket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_pocket public.savings_pockets%rowtype;
  v_family_id uuid;
  v_balance int;
  v_reserved int;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_pocket
  from public.savings_pockets
  where id = p_pocket_id and is_active;
  if not found then
    raise exception 'pocket_not_found' using errcode = 'P0001';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = v_pocket.profile_id;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user
      and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  if not coalesce(
    (select fs.savings_enabled from public.family_settings fs where fs.family_id = v_family_id),
    true
  ) then
    raise exception 'savings_disabled' using errcode = 'P0001';
  end if;

  v_balance := public.compute_savings_pocket_balance(p_pocket_id);
  if v_balance > 0 then
    raise exception 'pocket_not_empty' using errcode = 'P0001';
  end if;

  v_reserved := public.compute_savings_reserved_balance(p_pocket_id);
  if v_reserved > 0 then
    raise exception 'pending_withdrawals' using errcode = 'P0001';
  end if;

  if public.pocket_is_locked(p_pocket_id) then
    raise exception 'pocket_locked' using errcode = 'P0001';
  end if;

  update public.savings_pockets
  set is_active = false
  where id = p_pocket_id;
end;
$$;

revoke all on function public.delete_savings_pocket (uuid) from public;
grant execute on function public.delete_savings_pocket (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: approve_savings_withdraw — tambah pengembalian HP ke target aktif
-- (setoran dari deposit_to_savings memotong goals.current_hp)
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

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (v_tx.profile_id, v_user, v_tx.amount, 'savings_withdraw', null)
  returning id into v_ledger_id;

  v_remaining := v_tx.amount;
  for g in
    select *
    from public.goals
    where profile_id = v_tx.profile_id
      and status = 'active'
    order by created_at desc
  loop
    exit when v_remaining <= 0;
    update public.goals
    set
      current_hp = current_hp + v_remaining,
      updated_at = now()
    where id = g.id;
    v_remaining := 0;
  end loop;

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
      || ' disetujui! Energi kembali ke target aktifmu.'
  );
end;
$$;

revoke all on function public.approve_savings_withdraw (uuid) from public;
grant execute on function public.approve_savings_withdraw (uuid) to authenticated;
