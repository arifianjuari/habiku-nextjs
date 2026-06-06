-- W7/W8 follow-up: savings_pockets & savings_transactions sudah punya RLS SELECT
-- untuk anggota keluarga, tapi GRANT SELECT ke peran `authenticated` belum diberikan.
-- Akibatnya PostgREST mengembalikan kosong/error — kantong tidak tampil di UI ortu/anak
-- meski sudah dibuat via RPC SECURITY DEFINER.

grant select on public.savings_pockets to authenticated;
grant select on public.savings_transactions to authenticated;

-- goal_claim_requests (W8): sama — hanya baca via klien, mutasi via RPC.
grant select on public.goal_claim_requests to authenticated;
