-- Fase 9.1 follow-up: tabel `daily_check_ins` punya RLS SELECT untuk anggota
-- keluarga, tapi belum diberi GRANT SELECT ke peran `authenticated`. Akibatnya
-- query klien (mis. perhitungan rantai 7 hari di `fetchChildDashboard`,
-- pengecekan `bonusedToday`, dan kartu engagement ortu) menerima 0 baris meski
-- RPC `award_daily_checkin_bonus` sudah menulis ke tabel.
-- Dampak UI: tombol "Klaim bonus harian +2 poin" tetap muncul walau bonus
-- sudah ter-claim, dan rantai 7 hari tidak ter-update.

grant select on public.daily_check_ins to authenticated;

-- INSERT/UPDATE/DELETE tetap hanya boleh via RPC SECURITY DEFINER.
