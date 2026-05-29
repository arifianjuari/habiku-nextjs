-- Tabel goal_requests dibuat dengan RLS tetapi tanpa GRANT ke `authenticated`,
-- sehingga PostgREST mengembalikan permission denied — halaman mode anak
-- menganggap fitur belum tersedia. Selaraskan dengan tabel goals / child_profiles.

grant select, insert, update on public.goal_requests to authenticated;
