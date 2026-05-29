-- Tujuan bersama keluarga (milestone, Opsi A PRD): judul + target poin orang tua.
-- Progres dihitung di klien dari jumlah point_ledger type=earn semua anak dalam keluarga
-- (sama definisi dengan agregat «total energi terkumpul» lintas anak).
--
-- Kolom celebration_dismissed: menyembunyikan modal capai target hingga ortu mengubah judul/target
-- atau menekan «Mengerti» setelah capai.

alter table public.family_settings
  add column if not exists shared_family_goal_title text,
  add column if not exists shared_family_goal_target_points int,
  add column if not exists shared_family_goal_celebration_dismissed boolean not null default false;

comment on column public.family_settings.shared_family_goal_title is
  'Judul tujuan bersama (ortu); null/kosong = fitur milestone keluarga tidak aktif.';
comment on column public.family_settings.shared_family_goal_target_points is
  'Target poin (earn, lintas anak) untuk cap tujuan; null jika tidak aktif. Domain 10..999999.';
comment on column public.family_settings.shared_family_goal_celebration_dismissed is
  'Set true setelah ortu menutup modal selebrasi capai target; di-reset ketika judul/target diubah.';

-- Bersihkan kombinasi tidak konsisten
update public.family_settings
set
  shared_family_goal_target_points = null,
  shared_family_goal_title = null,
  shared_family_goal_celebration_dismissed = false
where
  (shared_family_goal_title is null or trim(shared_family_goal_title) = '')
  and shared_family_goal_target_points is not null;

update public.family_settings
set shared_family_goal_target_points = null
where shared_family_goal_target_points is not null
  and (shared_family_goal_target_points < 10 or shared_family_goal_target_points > 999999);

alter table public.family_settings
  drop constraint if exists family_settings_shared_goal_target_range;

alter table public.family_settings
  add constraint family_settings_shared_goal_target_range
  check (
    shared_family_goal_target_points is null
    or (
      shared_family_goal_target_points >= 10
      and shared_family_goal_target_points <= 999999
    )
  );
