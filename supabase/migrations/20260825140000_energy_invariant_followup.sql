-- Invarian energi: tindak lanjut 20260825130000_savings_accounting_integrity.sql
--
-- Invarian resmi yang ditegakkan di sini:
--   compute_wallet_balance(p)
--     = compute_goal_held_energy(p) + compute_unallocated_energy(p)
--
-- Artinya: setiap energi yang masuk dompet harus mendarat di goal (active atau
-- ready_to_claim), atau tercatat eksplisit sebagai "belum teralokasi" — tidak pernah
-- hilang diam-diam.

-- ---------------------------------------------------------------------------
-- Allocator bersama: satu-satunya jalur yang menambah HP goal dari kredit dompet
-- ---------------------------------------------------------------------------

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
  v_last_goal_id uuid;
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
      v_last_goal_id := g.id;
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
    v_last_goal_id := coalesce(v_last_goal_id, g.id);
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

  -- 3) Semua goal penuh tapi masih ada sisa → taruh di goal aktif terbaru,
  --    boleh melewati target. Aman: klaim hadiah mendebit current_hp, bukan target_hp.
  if v_remaining > 0 then
    select * into g from public.goals
    where profile_id = p_profile_id and status = 'active'
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

  -- Sisa hanya mungkin > 0 bila anak tidak punya goal aktif sama sekali.
  -- Itu terlihat di compute_unallocated_energy, bukan hilang diam-diam.
  return v_allocated;
end;
$$;

revoke all on function public.allocate_energy_to_goals (uuid, int, uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- Metrik jujur: energi tertahan di goal + energi yang belum teralokasi
-- ---------------------------------------------------------------------------

-- Energi yang benar-benar dipegang goal. Termasuk ready_to_claim: HP-nya nyata,
-- hanya belum bisa dibelanjakan. compute_savable_goal_energy sengaja TIDAK diubah —
-- ia tetap gerbang "boleh ditabung/dibelikan emas" dan hanya menghitung active.
create or replace function public.compute_goal_held_energy (p_profile_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce(sum(current_hp), 0)::int
  from public.goals
  where profile_id = p_profile_id
    and status in ('active', 'ready_to_claim');
$$;

-- Kredit dompet yang tidak pernah mendarat di goal (mis. disetujui saat anak
-- belum punya target aktif). Bukan drift — tapi harus terlihat, bukan tersembunyi.
create or replace function public.compute_unallocated_energy (p_profile_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select greatest(
    coalesce((
      select sum(amount) from public.point_ledger
      where profile_id = p_profile_id and type in ('earn', 'bonus_checkin')
    ), 0)
    - coalesce((
      select sum(amount) from public.goal_progress_events
      where profile_id = p_profile_id
    ), 0),
    0
  )::int;
$$;

drop view if exists public.energy_drift;

create view public.energy_drift as
select
  c.id as profile_id,
  c.name,
  public.compute_wallet_balance(c.id)        as wallet_balance,
  public.compute_goal_held_energy(c.id)      as goal_held_energy,
  public.compute_savable_goal_energy(c.id)   as savable_goal_energy,
  public.compute_unallocated_energy(c.id)    as unallocated_energy,
  public.compute_wallet_balance(c.id)
    - public.compute_goal_held_energy(c.id)
    - public.compute_unallocated_energy(c.id) as drift
from public.child_profiles c
where c.archived_at is null;

comment on view public.energy_drift is
  'Rekonsiliasi dompet vs energi goal. drift = wallet - goal_held - unallocated; target 0. '
  'goal_held mencakup ready_to_claim; savable_goal_energy (active saja) tetap gerbang belanja.';

-- ---------------------------------------------------------------------------
-- T6 lanjutan: kunci deposito dinilai per periode, bukan pada now()
-- ---------------------------------------------------------------------------

create or replace function public.pocket_locked_at (p_pocket_id uuid, p_at timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.savings_pockets p
    join public.savings_transactions t on t.pocket_id = p.id
    where p.id = p_pocket_id
      and p.pocket_type = 'term'
      and t.kind = 'deposit'
      and t.locked_until is not null
      and t.locked_until > p_at
  );
$$;

-- ---------------------------------------------------------------------------
-- T4 lanjutan: bunga tercatat di Buku Kas, dompet tetap netral
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
  v_interest int;
  v_effective_bps int;
  v_count int := 0;
  v_family_interest boolean;
  v_last_interest timestamptz;
  v_period_month timestamptz;
  v_target_month timestamptz;
  v_ledger_id uuid;
begin
  v_target_month := date_trunc('month', now());

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

    select max(t.created_at) into v_last_interest
    from public.savings_transactions t
    where t.pocket_id = v_pocket.id and t.kind = 'interest';

    if v_last_interest is null then
      select min(t.created_at) into v_last_interest
      from public.savings_transactions t
      where t.pocket_id = v_pocket.id and t.kind = 'deposit';
    end if;

    if v_last_interest is null then
      v_last_interest := v_pocket.created_at;
    end if;

    v_period_month := date_trunc('month', v_last_interest);

    v_effective_bps := floor(
      v_pocket.monthly_interest_bps::numeric * v_pocket.lock_bonus_coefficient
    )::int;

    while v_period_month < v_target_month loop
      v_period_month := v_period_month + interval '1 month';

      if exists (
        select 1 from public.savings_transactions t
        where t.pocket_id = v_pocket.id
          and t.kind = 'interest'
          and t.created_at >= v_period_month
          and t.created_at < v_period_month + interval '1 month'
      ) then
        continue;
      end if;

      -- Deposito hanya berbunga selama periode itu memang terkunci. Dinilai pada
      -- awal periode yang dikejar, bukan pada now() — kalau tidak, deposito yang
      -- baru jatuh tempo kehilangan seluruh bulan tertunggaknya.
      if v_pocket.pocket_type = 'term'
         and not public.pocket_locked_at(v_pocket.id, v_period_month) then
        continue;
      end if;

      v_balance := public.compute_savings_pocket_balance(v_pocket.id);
      v_interest := floor(v_balance::numeric * v_effective_bps / 10000)::int;
      if v_interest < 1 then
        continue;
      end if;

      -- Bunga = energi baru. Dicatat di Buku Kas sebagai savings_interest (+I),
      -- lalu langsung dipindahkan ke kantong sebagai savings_deposit (-I).
      -- Dompet netral, kantong naik, dan anak bisa melihat bunganya.
      insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
      values (v_pocket.profile_id, null, v_interest, 'savings_interest', null)
      returning id into v_ledger_id;

      insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
      values (v_pocket.profile_id, null, -v_interest, 'savings_deposit', null);

      insert into public.savings_transactions (
        pocket_id, profile_id, kind, amount, ledger_id, requested_by_account_id, last_interest_at
      )
      values (
        v_pocket.id, v_pocket.profile_id, 'interest', v_interest, v_ledger_id, null, now()
      );

      insert into public.notifications (recipient_id, recipient_type, type, content)
      values (
        v_pocket.profile_id, 'profile', 'savings_interest_posted',
        'Bunga ' || v_interest::text || ' energi masuk ke kantong «' || v_pocket.name || '».'
      );

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.accrue_savings_interest from public;
grant execute on function public.accrue_savings_interest to service_role;

-- ---------------------------------------------------------------------------
-- Jalur kredit dompet memakai allocator (tidak ada energi yang menguap)
-- ---------------------------------------------------------------------------

create or replace function public.approve_task_history (p_task_history_id uuid, p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  th public.task_history%rowtype;
  t public.tasks%rowtype;
  v_family_id uuid;
  v_tz text;
  v_today date;
  v_ledger_id uuid;
  v_base_amount int;
  v_amount int;
  v_multiplier numeric;
  v_is_featured boolean;
  v_featured_id uuid;
  s public.streaks%rowtype;
  v_streak int;
  v_best int;
  v_has_active boolean;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into th from public.task_history where id = p_task_history_id for update;
  if not found then raise exception 'task_history_not_found'; end if;
  if th.status is distinct from 'pending' then raise exception 'not_pending' using errcode = 'P0001'; end if;

  select * into t from public.tasks where id = th.task_id;
  if not found or t.profile_id is distinct from th.profile_id then raise exception 'task_mismatch'; end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = th.profile_id;
  if v_family_id is null then raise exception 'profile_not_found'; end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_tz := (select f.timezone from public.families f where f.id = v_family_id);
  v_today := (timezone(coalesce(v_tz, 'UTC'), now()))::date;

  select task_id into v_featured_id from public.compute_featured_task(th.profile_id, v_today);
  v_is_featured := (v_featured_id is not null and v_featured_id = t.id);
  v_base_amount := t.reward_points;

  if v_is_featured then
    v_multiplier := public._featured_multiplier_value(v_family_id);
    if v_multiplier is null or v_multiplier <= 0 then v_multiplier := 1.0; end if;
    v_amount := floor(v_base_amount::numeric * v_multiplier)::int;
  else
    v_amount := v_base_amount;
  end if;

  select exists (
    select 1 from public.goals where profile_id = th.profile_id and status = 'active'
  ) into v_has_active;

  if p_goal_id is null then
    if v_has_active then raise exception 'goal_required' using errcode = 'P0001'; end if;
  else
    if not exists (
      select 1 from public.goals
      where id = p_goal_id and profile_id = th.profile_id and status = 'active'
    ) then
      raise exception 'invalid_goal' using errcode = 'P0001';
    end if;
  end if;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (th.profile_id, v_user, v_amount, 'earn', p_task_history_id)
  returning id into v_ledger_id;

  perform public.allocate_energy_to_goals(th.profile_id, v_amount, v_ledger_id, p_goal_id);

  select * into s from public.streaks
  where profile_id = th.profile_id and task_category = t.category
  for update;

  if not found then
    insert into public.streaks (profile_id, task_category, current_streak, best_streak, last_completed_date, updated_at)
    values (th.profile_id, t.category, 1, 1, v_today, now());
  else
    if s.last_completed_date is null then v_streak := 1;
    elsif s.last_completed_date = v_today then v_streak := s.current_streak;
    elsif s.last_completed_date = v_today - 1 then v_streak := s.current_streak + 1;
    else v_streak := 1;
    end if;
    v_best := greatest(s.best_streak, v_streak);
    update public.streaks
    set current_streak = v_streak, best_streak = v_best, last_completed_date = v_today, updated_at = now()
    where id = s.id;
  end if;

  update public.task_history
  set status = 'approved', approved_by_account_id = v_user, approved_at = now()
  where id = p_task_history_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    th.profile_id, 'profile', 'task_approved',
    case
      when v_is_featured then
        'Misi sorotan disetujui. +' || v_amount::text || ' poin (sorotan x'
          || trim(trailing '.0' from v_multiplier::text) || ').'
      else 'Misi selesai disetujui. +' || v_amount::text || ' poin.'
    end
  );
end;
$$;

revoke all on function public.approve_task_history (uuid, uuid) from public;
grant execute on function public.approve_task_history (uuid, uuid) to authenticated;

-- Bonus check-in harian sebelumnya hanya menambah dompet, tidak pernah menyentuh
-- goal — penyumbang terbesar energi yang tidak teralokasi.
create or replace function public.award_daily_checkin_bonus (p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_tz text;
  v_today date;
  v_existing record;
  v_ledger_id uuid;
  v_check_id uuid;
  v_chain_len int;
  v_bonus int;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c where c.id = p_profile_id;
  if v_family_id is null then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_tz := (select f.timezone from public.families f where f.id = v_family_id);
  v_today := (timezone(coalesce(v_tz, 'UTC'), now()))::date;

  select fs.daily_check_in_bonus into v_bonus
  from public.family_settings fs where fs.family_id = v_family_id;
  if v_bonus is null then v_bonus := 2; end if;
  if v_bonus not in (1, 2, 3, 5, 10) then v_bonus := 2; end if;

  select id, bonus_awarded into v_existing
  from public.daily_check_ins
  where profile_id = p_profile_id and check_in_date = v_today
  limit 1;
  if found then
    v_chain_len := public.compute_check_in_chain_length(p_profile_id);
    return jsonb_build_object(
      'already', true, 'bonus', 0,
      'chain_length', v_chain_len, 'check_in_date', v_today::text
    );
  end if;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (p_profile_id, v_user, v_bonus, 'bonus_checkin', null)
  returning id into v_ledger_id;

  insert into public.daily_check_ins (profile_id, check_in_date, bonus_awarded, ledger_id)
  values (p_profile_id, v_today, v_bonus, v_ledger_id)
  on conflict (profile_id, check_in_date) do nothing
  returning id into v_check_id;

  if v_check_id is null then
    delete from public.point_ledger where id = v_ledger_id;
    v_chain_len := public.compute_check_in_chain_length(p_profile_id);
    return jsonb_build_object(
      'already', true, 'bonus', 0,
      'chain_length', v_chain_len, 'check_in_date', v_today::text
    );
  end if;

  perform public.allocate_energy_to_goals(p_profile_id, v_bonus, v_ledger_id, null);

  v_chain_len := public.compute_check_in_chain_length(p_profile_id);
  return jsonb_build_object(
    'already', false, 'bonus', v_bonus,
    'chain_length', v_chain_len, 'check_in_date', v_today::text
  );
end;
$$;

revoke all on function public.award_daily_checkin_bonus (uuid) from public;
grant execute on function public.award_daily_checkin_bonus (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Koreksi historis, idempoten lewat jejak audit
-- ---------------------------------------------------------------------------

create table if not exists public.accounting_repairs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  repair_kind text not null,
  reference_id uuid,
  amount int not null,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists accounting_repairs_kind_ref_idx
  on public.accounting_repairs (repair_kind, reference_id)
  where reference_id is not null;

create index if not exists accounting_repairs_profile_idx
  on public.accounting_repairs (profile_id);

alter table public.accounting_repairs enable row level security;

comment on table public.accounting_repairs is
  'Jejak koreksi akuntansi historis. Mencegah perbaikan yang sama dijalankan dua kali.';

-- T3 historis: jual emas lama mengkredit dompet tanpa mengembalikan HP goal.
do $$
declare
  r record;
  v_allocated int;
begin
  for r in
    select gt.id, gt.profile_id, gt.energy_amount, gt.ledger_id
    from public.gold_transactions gt
    where gt.kind = 'sell'
      and gt.status = 'approved'
      and gt.ledger_id is not null
      and not exists (
        select 1 from public.goal_progress_events gpe
        where gpe.ledger_id = gt.ledger_id
      )
      and not exists (
        select 1 from public.accounting_repairs ar
        where ar.repair_kind = 'gold_sell_hp_restore' and ar.reference_id = gt.id
      )
  loop
    v_allocated := public.allocate_energy_to_goals(
      r.profile_id, r.energy_amount, r.ledger_id, null
    );

    insert into public.accounting_repairs (profile_id, repair_kind, reference_id, amount, note)
    values (
      r.profile_id, 'gold_sell_hp_restore', r.id, v_allocated,
      'Kembalikan HP goal untuk jual emas sebelum perbaikan simetri T3.'
    );
  end loop;
end;
$$;

-- Energi earn/bonus lama yang tidak pernah mendarat di goal (plafon target penuh
-- dan bonus check-in yang tidak pernah menyentuh goal).
do $$
declare
  r record;
  v_gap int;
  v_ledger_id uuid;
  v_allocated int;
begin
  for r in
    select c.id as profile_id
    from public.child_profiles c
    where c.archived_at is null
      and not exists (
        select 1 from public.accounting_repairs ar
        where ar.repair_kind = 'unallocated_energy_restore' and ar.profile_id = c.id
      )
  loop
    v_gap := public.compute_unallocated_energy(r.profile_id);
    if v_gap < 1 then
      continue;
    end if;

    -- Lampirkan ke baris ledger earn/bonus terakhir milik anak: goal_progress_events
    -- mewajibkan ledger_id, dan jejak sebenarnya dicatat di accounting_repairs.
    select id into v_ledger_id
    from public.point_ledger
    where profile_id = r.profile_id and type in ('earn', 'bonus_checkin')
    order by created_at desc limit 1;

    if v_ledger_id is null then
      continue;
    end if;

    v_allocated := public.allocate_energy_to_goals(r.profile_id, v_gap, v_ledger_id, null);

    insert into public.accounting_repairs (profile_id, repair_kind, reference_id, amount, note)
    values (
      r.profile_id, 'unallocated_energy_restore', null, v_allocated,
      'Kembalikan energi earn/bonus yang tidak pernah mendarat di goal.'
    );
  end loop;
end;
$$;
