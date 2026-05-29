-- Realtime publication: tambahkan tabel inti agar channel postgres_changes
-- di klien (Beranda Parent/Anak, Antrean, Tab Tugas/Target, Point Ledger,
-- Badges, Garden, Detail Target, Settings Engagement) benar-benar menerima
-- event. Sebelum migrasi ini, hanya `notifications` yang ada di publication
-- `supabase_realtime` — semua subscription di klien diam tanpa error.
--
-- Idempotent: cek dulu sebelum ALTER PUBLICATION supaya aman dijalankan ulang.
--
-- Catatan biaya/perform: visibility tetap dibatasi RLS (tabel-tabel ini sudah
-- punya policy SELECT terbatas keluarga), jadi setiap klien hanya menerima
-- event untuk baris yang ia berhak SELECT. Tidak ada policy baru di sini.

do $$
declare
  tbl text;
  target_tables text[] := array[
    'task_history',
    'tasks',
    'task_requests',
    'goals',
    'goal_requests',
    'goal_progress_events',
    'streaks',
    'child_profiles',
    'families',
    'family_settings',
    'point_ledger',
    'child_badges',
    'child_daily_reflections',
    'daily_check_ins'
  ];
begin
  -- Pastikan publication ada (Supabase membuatnya secara default, tapi defensif).
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach tbl in array target_tables loop
    -- Hanya tambahkan jika tabel ada di schema public DAN belum ter-publish.
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    )
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    )
    then
      execute format('alter publication supabase_realtime add table public.%I;', tbl);
    end if;
  end loop;
end $$;
