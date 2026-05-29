-- Habiku Fase 9.A — perbaikan privilege table-level untuk `family_settings`.
--
-- Migrasi awal (20260613120000) hanya membuat tabel + RLS policy, tetapi lupa
-- memberi GRANT SELECT, UPDATE pada role `authenticated`. Akibatnya request
-- update dari klien (PostgREST) menulis 0 baris secara senyap meski user
-- adalah `primary_parent` — RLS policy tidak pernah dievaluasi karena akses
-- tabel di-deny lebih dulu di lapisan privilege.
--
-- Pola di repo ini: SELECT + UPDATE diberikan ke `authenticated`; INSERT &
-- DELETE tetap di-revoke (row dikelola oleh trigger `ensure_family_settings_row`).

grant select, update on table public.family_settings to authenticated;

revoke insert, delete on public.family_settings from public;
revoke insert, delete on public.family_settings from authenticated;
revoke insert, delete on public.family_settings from anon;
