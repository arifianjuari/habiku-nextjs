-- Fase 9.11 follow-up: tabel child_daily_reflections sudah punya RLS SELECT untuk
-- anggota family, tapi GRANT SELECT ke peran `authenticated` belum pernah diberikan.
-- Akibatnya PostgREST menolak query select pada klien (anak/ortu) — UI menampilkan
-- "Belum ada refleksi" walau baris sudah tersimpan via RPC SECURITY DEFINER.

grant select on public.child_daily_reflections to authenticated;

-- INSERT/UPDATE tetap hanya boleh via RPC SECURITY DEFINER `submit_child_reflection`.
-- Jangan beri grant insert/update di sini.
