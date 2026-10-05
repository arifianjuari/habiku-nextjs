-- Perbaikan allocate_energy_to_goals: overflow kehilangan tujuan setelah goal
-- berubah menjadi ready_to_claim.
--
-- BUG (ditemukan saat menjalankan 20261005020000):
-- Langkah 2 mengisi goal aktif sampai target. Begitu HP mencapai target,
-- resolve_goal_status_on_hp_reached() mengubah status goal itu menjadi
-- 'ready_to_claim'. Langkah 3 (overflow) lalu mencari goal dengan
-- status = 'active' — dan pada anak yang hanya punya satu goal, tidak menemukan
-- apa pun. Sisa energi tidak dialokasikan, padahal komentar di fungsi lama
-- menyatakan hal itu "hanya mungkin bila anak tidak punya goal aktif sama sekali".
-- Pernyataan itu salah.
--
-- Terbukti pada rekonsiliasi Arvin: drift 103, teralokasi hanya 56 (44 -> 100),
-- sisa 47 menggantung.
--
-- PERBAIKAN: cabang overflow juga menerima goal 'ready_to_claim'. Aman karena
-- compute_goal_held_energy() menghitung status 'active' + 'ready_to_claim', dan
-- approve_goal_reward_redeem mendebit current_hp (bukan target_hp), jadi energi
-- yang melewati target tetap bisa diklaim dan tetap terlihat di invariant.

create or replace function public.allocate_energy_to_goals (
  p_profile_id uuid,
  p_amount int,
  p_ledger_id uuid,
  p_preferred_goal_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_remaining int;
  v_allocated int := 0;
  v_add int;
  v_new_hp int;
  g record;
begin
  if p_amount is null or p_amount < 1 then
    return 0;
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c where c.id = p_profile_id;

  v_remaining := p_amount;

  -- 1) Goal pilihan lebih dulu (bila masih aktif dan punya ruang).
  if p_preferred_goal_id is not null then
    select * into g from public.goals
    where id = p_preferred_goal_id and profile_id = p_profile_id and status = 'active'
    for update;

    if found then
      v_add := least(v_remaining, greatest(0, g.target_hp - g.current_hp));
      if v_add > 0 then
        v_new_hp := g.current_hp + v_add;
        insert into public.goal_progress_events (profile_id, goal_id, ledger_id, amount)
        values (p_profile_id, g.id, p_ledger_id, v_add);
        update public.goals
        set current_hp = v_new_hp,
            status = public.resolve_goal_status_on_hp_reached(
              g.status::public.goal_status, v_new_hp, g.target_hp, v_family_id),
            updated_at = now()
        where id = g.id;
        v_remaining := v_remaining - v_add;
        v_allocated := v_allocated + v_add;
      end if;
    end if;
  end if;

  -- 2) Goal aktif lain, tertua dulu, diisi sampai target.
  for g in
    select * from public.goals
    where profile_id = p_profile_id
      and status = 'active'
      and (p_preferred_goal_id is null or id is distinct from p_preferred_goal_id)
    order by created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_add := least(v_remaining, greatest(0, g.target_hp - g.current_hp));
    if v_add > 0 then
      v_new_hp := g.current_hp + v_add;
      insert into public.goal_progress_events (profile_id, goal_id, ledger_id, amount)
      values (p_profile_id, g.id, p_ledger_id, v_add);
      update public.goals
      set current_hp = v_new_hp,
          status = public.resolve_goal_status_on_hp_reached(
            g.status::public.goal_status, v_new_hp, g.target_hp, v_family_id),
          updated_at = now()
      where id = g.id;
      v_remaining := v_remaining - v_add;
      v_allocated := v_allocated + v_add;
    end if;
  end loop;

  -- 3) Semua goal penuh tapi masih ada sisa → taruh di goal terbaru yang masih
  --    memegang energi. 'ready_to_claim' ikut diterima: goal yang baru penuh di
  --    langkah 2 sudah berpindah ke status itu, dan dulu membuat sisa menggantung.
  if v_remaining > 0 then
    select * into g from public.goals
    where profile_id = p_profile_id
      and status in ('active', 'ready_to_claim')
    order by created_at desc limit 1
    for update;

    if found then
      v_new_hp := g.current_hp + v_remaining;
      insert into public.goal_progress_events (profile_id, goal_id, ledger_id, amount)
      values (p_profile_id, g.id, p_ledger_id, v_remaining);
      update public.goals
      set current_hp = v_new_hp,
          status = public.resolve_goal_status_on_hp_reached(
            g.status::public.goal_status, v_new_hp, g.target_hp, v_family_id),
          updated_at = now()
      where id = g.id;
      v_allocated := v_allocated + v_remaining;
      v_remaining := 0;
    end if;
  end if;

  -- Sisa hanya mungkin > 0 bila anak tidak punya goal 'active'/'ready_to_claim'
  -- sama sekali. Itu terlihat di compute_unallocated_energy, bukan hilang diam-diam.
  return v_allocated;
end;
$$;

-- Selesaikan rekonsiliasi yang tertahan karena bug di atas.
-- Pagar di sini adalah drift itu sendiri, bukan "sudah pernah diperbaiki": alokasi
-- selalu sebesar drift terukur, jadi setelah drift 0 pengulangan tidak berefek.
do $$
declare
  r record;
  v_drift int;
  v_ledger_id uuid;
  v_allocated int;
begin
  for r in
    select c.id as profile_id from public.child_profiles c where c.archived_at is null
  loop
    v_drift := public.compute_wallet_balance(r.profile_id)
             - public.compute_goal_held_energy(r.profile_id)
             - public.compute_unallocated_energy(r.profile_id);

    if v_drift < 1 then
      continue;
    end if;

    select id into v_ledger_id
    from public.point_ledger
    where profile_id = r.profile_id and type = 'savings_withdraw' and amount > 0
    order by created_at desc limit 1;

    if v_ledger_id is null then
      select id into v_ledger_id
      from public.point_ledger
      where profile_id = r.profile_id and amount > 0
      order by created_at desc limit 1;
    end if;

    if v_ledger_id is null then
      continue;
    end if;

    v_allocated := public.allocate_energy_to_goals(r.profile_id, v_drift, v_ledger_id, null);

    if v_allocated < 1 then
      continue;
    end if;

    insert into public.accounting_repairs (profile_id, repair_kind, reference_id, amount, note)
    values (
      r.profile_id, 'withdraw_overflow_drift_reconciliation', null, v_allocated,
      'Sisa rekonsiliasi setelah perbaikan cabang overflow allocate_energy_to_goals.'
    );
  end loop;
end;
$$;
