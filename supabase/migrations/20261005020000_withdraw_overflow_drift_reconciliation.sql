-- Rekonsiliasi sisa drift dari penarikan tabungan pra-perbaikan overflow HP.
--
-- TEMUAN (ditelusuri 5 Okt 2026):
-- Sisa drift satu-satunya yang masih ada setelah 20260825160000 bukan warisan
-- "goal selesai jalur lama" seperti yang sebelumnya diduga, melainkan residu dari
-- satu transaksi yang bisa ditunjuk: penarikan tabungan 430 energi yang disetujui
-- 12 Sep 2026. Versi approve_savings_withdraw saat itu mengkredit dompet penuh,
-- tetapi menaikkan current_hp goal hanya sampai batas target_hp tiap goal aktif —
-- sisanya dibuang tanpa jejak. Satu-satunya goal aktif anak itu sudah mendekati
-- target, jadi sebagian kredit dompet tidak pernah mendarat di goal manapun.
--
-- Bug penyebabnya SUDAH ditutup di 20260930120000 (penarikan kini overflow
-- melewati target, sama seperti allocate_energy_to_goals). Migrasi ini hanya
-- membereskan residu historisnya.
--
-- Bukti identitas yang dipakai (per anak):
--   goal_held_seharusnya = (earn + bonus_checkin + savings_withdraw)
--                        - (goal_redeem_spend + savings_deposit_nyata + gold_buy)
-- yang untuk anak terdampak sama dengan saldo dompet, sedangkan
-- compute_goal_held_energy() nyatanya lebih kecil. Selisih itulah yang
-- dikembalikan di sini.
--
-- KEPUTUSAN: konsisten dengan 20260825160000 — naikkan HP goal agar cocok dengan
-- dompet, JANGAN potong dompet. Energi ini benar-benar ditarik anak dari
-- tabungannya sendiri; dompet adalah catatan yang benar.
--
-- Alokasi dilampirkan ke baris ledger savings_withdraw terakhir bila ada (bukan ke
-- baris earn/bonus), supaya compute_unallocated_energy — yang hanya menghitung
-- ledger earn/bonus_checkin — tidak ikut terdistorsi. Jejak sebenarnya dicatat di
-- accounting_repairs.

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
        where ar.repair_kind = 'withdraw_overflow_drift_reconciliation'
          and ar.profile_id = c.id
      )
  loop
    v_drift := public.compute_wallet_balance(r.profile_id)
             - public.compute_goal_held_energy(r.profile_id)
             - public.compute_unallocated_energy(r.profile_id);

    if v_drift < 1 then
      continue;
    end if;

    -- Utamakan ledger penarikan tabungan: itu sumber residu yang sedang dibereskan.
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

    -- Tanpa goal aktif, alokasi = 0 dan drift tetap terlihat di energy_drift.
    -- Jangan catat repair palsu untuk kasus itu; biar bisa dijalankan ulang nanti.
    if v_allocated < 1 then
      continue;
    end if;

    insert into public.accounting_repairs (profile_id, repair_kind, reference_id, amount, note)
    values (
      r.profile_id, 'withdraw_overflow_drift_reconciliation', null, v_allocated,
      'Kembalikan sisa HP penarikan tabungan yang dibuang karena target goal penuh '
      || '(bug approve_savings_withdraw sebelum 20260930120000).'
    );
  end loop;
end;
$$;
