-- Rekonsiliasi sisa drift warisan (pra-perbaikan integritas).
--
-- Sisa drift setelah 20260825140000 + 20260825150000 berasal dari transaksi lama
-- yang jejaknya tidak lagi bisa direkonstruksi per-transaksi:
--
--   a) Goal yang diselesaikan lewat alur lama tanpa baris goal_claim_requests dan
--      tanpa debit dompet — HP-nya hilang dari goal, dompet tidak pernah berkurang.
--   b) approve_savings_withdraw versi lama yang mengkredit dompet tetapi diam-diam
--      membuang alokasi HP ketika anak tidak punya goal aktif (temuan T7).
--
-- KEPUTUSAN: rekonsiliasi dilakukan dengan **menaikkan HP agar cocok dengan dompet**,
-- bukan memotong dompet. Alasannya konsisten dengan perbaikan gold_sell historis
-- (repair_kind = 'gold_sell_hp_restore'): saldo dompet adalah catatan energi yang
-- benar-benar diperoleh anak, dan anak tidak boleh kehilangan energi yang sudah
-- terlanjur ia lihat karena bug akuntansi kita.
--
-- Konsekuensinya anak bisa membelanjakan energi yang sebelumnya "macet". Itu
-- disengaja. Alternatifnya (memotong dompet) berarti mengambil energi yang sudah
-- ditampilkan sebagai miliknya.

do $$
declare
  r record;
  v_drift int;
  v_ledger_id uuid;
  v_allocated int;
begin
  for r in
    select c.id as profile_id
    from public.child_profiles c
    where c.archived_at is null
      and not exists (
        select 1 from public.accounting_repairs ar
        where ar.repair_kind = 'legacy_drift_reconciliation' and ar.profile_id = c.id
      )
  loop
    v_drift := public.compute_wallet_balance(r.profile_id)
             - public.compute_goal_held_energy(r.profile_id)
             - public.compute_unallocated_energy(r.profile_id);

    if v_drift < 1 then
      continue;
    end if;

    -- Lampirkan ke baris ledger kredit terakhir milik anak; goal_progress_events
    -- mewajibkan ledger_id, dan jejak sebenarnya dicatat di accounting_repairs.
    select id into v_ledger_id
    from public.point_ledger
    where profile_id = r.profile_id and amount > 0
    order by created_at desc limit 1;

    if v_ledger_id is null then
      continue;
    end if;

    v_allocated := public.allocate_energy_to_goals(r.profile_id, v_drift, v_ledger_id, null);

    insert into public.accounting_repairs (profile_id, repair_kind, reference_id, amount, note)
    values (
      r.profile_id, 'legacy_drift_reconciliation', null, v_allocated,
      'Rekonsiliasi drift warisan: goal selesai jalur lama + penarikan tabungan yang membuang alokasi HP.'
    );
  end loop;
end;
$$;
