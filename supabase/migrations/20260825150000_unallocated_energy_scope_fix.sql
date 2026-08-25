-- Perbaikan cakupan compute_unallocated_energy (temuan sesi ini, bukan T1-T14).
--
-- Bug: formula lama mengurangi sum(earn+bonus_checkin) dengan SEMUA
-- goal_progress_events milik anak — termasuk yang berasal dari ledger jenis lain
-- (mis. gold_sell). Akibatnya, alokasi gold_sell yang benar bisa menutupi celah
-- earn/bonus_checkin yang sungguhan tidak pernah teralokasi (guard "tidak ada
-- goal aktif" pada bonus check-in versi lama), sehingga compute_unallocated_energy
-- melaporkan 0 padahal energi itu benar-benar belum mendarat di goal manapun.
--
-- Perbaikan: hanya kurangi dengan goal_progress_events yang ledger_id-nya memang
-- berasal dari point_ledger bertipe earn/bonus_checkin.

create or replace function public.compute_unallocated_energy (p_profile_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select greatest(
    coalesce((
      select sum(pl.amount) from public.point_ledger pl
      where pl.profile_id = p_profile_id and pl.type in ('earn', 'bonus_checkin')
    ), 0)
    - coalesce((
      select sum(gpe.amount)
      from public.goal_progress_events gpe
      join public.point_ledger pl on pl.id = gpe.ledger_id
      where gpe.profile_id = p_profile_id
        and pl.type in ('earn', 'bonus_checkin')
    ), 0),
    0
  )::int;
$$;

-- Jalankan ulang perbaikan historis dengan rumus yang benar. Guard "sudah pernah
-- diperbaiki" (per profile_id, tanpa reference_id) tetap dipakai — profil yang
-- sudah punya baris repair (mis. Arvin, karena celah earn/bonus-nya memang sudah
-- 0 dengan rumus lama sekalipun) dilewati; ini aman karena rumus baru hanya
-- MENGECILKAN sisi pengurang gpe dibanding rumus lama, tidak pernah membesarkannya,
-- jadi profil yang sebelumnya sudah pas tetap pas.
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
      'Kembalikan energi earn/bonus yang tidak pernah mendarat di goal (rerun setelah perbaikan cakupan formula).'
    );
  end loop;
end;
$$;
