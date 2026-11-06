-- Cair hadiah fisik langsung selesai saat anak memilihnya.
-- Energi sudah masuk lewat misi yang ortu setujui, jadi klaim hadiah tidak
-- mengantre persetujuan lagi. Penarikan tabungan dan perdagangan emas tetap
-- lewat antrean ortu.
-- Permintaan yang sudah pending diselesaikan dengan akuntansi yang sama
-- seperti approve_goal_reward_redeem (debit goal_redeem_spend = current_hp).

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
  v_amount int;
  v_child_name text;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_goal from public.goals where id = p_goal_id for update;
  if not found then raise exception 'goal_not_found'; end if;

  if v_goal.status <> 'ready_to_claim' or v_goal.current_hp < 1 then
    raise exception 'goal_not_ready' using errcode = 'P0001';
  end if;

  v_amount := v_goal.current_hp;

  select c.family_id, c.name into v_family_id, v_child_name
  from public.child_profiles c
  where c.id = v_goal.profile_id;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
  ) then
    raise exception 'forbidden';
  end if;

  if public.compute_wallet_balance(v_goal.profile_id) < v_amount then
    raise exception 'insufficient_wallet' using errcode = 'P0001';
  end if;

  select id into v_id
  from public.goal_claim_requests
  where goal_id = p_goal_id and status = 'pending'
  for update;

  if v_id is null then
    insert into public.goal_claim_requests (
      goal_id,
      profile_id,
      requested_by_account_id,
      status,
      reviewed_by_account_id,
      reviewed_at
    )
    values (p_goal_id, v_goal.profile_id, v_user, 'approved', v_user, now())
    returning id into v_id;
  else
    update public.goal_claim_requests
    set status = 'approved',
        reviewed_by_account_id = v_user,
        reviewed_at = now()
    where id = v_id;
  end if;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (v_goal.profile_id, v_user, -v_amount, 'goal_redeem_spend', null);

  update public.goals
  set current_hp = 0, status = 'completed', updated_at = now()
  where id = v_goal.id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    v_goal.profile_id,
    'profile',
    'goal_claim_approved',
    'Hadiah «' || v_goal.title || '» sudah jadi milikmu! Selamat menikmati! 🎁'
  );

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'goal_claim_redeemed',
    coalesce(v_child_name, 'Anak')
      || ' mencairkan hadiah «' || v_goal.title || '» ('
      || v_amount::text || ' energi).'
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent');

  return v_id;
end;
$$;

revoke all on function public.request_goal_reward_redeem (uuid) from public;
grant execute on function public.request_goal_reward_redeem (uuid) to authenticated;

-- Selesaikan antrean yang sudah terlanjur pending sebelum fungsi di atas aktif.
do $$
declare
  r record;
  v_child_name text;
  v_family_id uuid;
begin
  for r in
    select
      gcr.id as request_id,
      gcr.requested_by_account_id,
      g.id as goal_id,
      g.profile_id,
      g.title,
      g.current_hp,
      g.status
    from public.goal_claim_requests gcr
    join public.goals g on g.id = gcr.goal_id
    where gcr.status = 'pending'
    order by gcr.created_at
    for update of gcr, g
  loop
    if r.status is distinct from 'ready_to_claim' or r.current_hp < 1 then
      continue;
    end if;

    if public.compute_wallet_balance(r.profile_id) < r.current_hp then
      raise exception 'insufficient_wallet_for_pending_claim'
        using errcode = 'P0001',
          detail = r.goal_id::text;
    end if;

    select c.name, c.family_id into v_child_name, v_family_id
    from public.child_profiles c
    where c.id = r.profile_id;

    insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
    values (r.profile_id, r.requested_by_account_id, -r.current_hp, 'goal_redeem_spend', null);

    update public.goal_claim_requests
    set status = 'approved',
        reviewed_by_account_id = r.requested_by_account_id,
        reviewed_at = now()
    where id = r.request_id;

    update public.goals
    set current_hp = 0, status = 'completed', updated_at = now()
    where id = r.goal_id;

    insert into public.notifications (recipient_id, recipient_type, type, content)
    values (
      r.profile_id,
      'profile',
      'goal_claim_approved',
      'Hadiah «' || r.title || '» sudah jadi milikmu! Selamat menikmati! 🎁'
    );

    insert into public.notifications (recipient_id, recipient_type, type, content)
    select a.id, 'account', 'goal_claim_redeemed',
      coalesce(v_child_name, 'Anak')
        || ' mencairkan hadiah «' || r.title || '» ('
        || r.current_hp::text || ' energi).'
    from public.accounts a
    where a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent');
  end loop;
end;
$$;
