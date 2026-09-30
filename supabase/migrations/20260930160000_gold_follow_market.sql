-- Keluarga yang memilih "Pakai harga pasar" diikuti cron harian.
-- Simpan harga manual mematikan flag ini agar harga kustom tidak tertimpa.

alter table public.family_settings
  add column if not exists gold_follow_market boolean not null default false;

comment on column public.family_settings.gold_follow_market is
  'Jika true dan tabung emas aktif, cron harian menimpa harga dari acuan dunia (energi = rupiah/gram / 1000, spread 2%). Simpan manual mengatur false.';
