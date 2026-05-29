-- Pesan hero "Energi keluarga" / beranda anak — sumber kebenaran di server (tidak hilang saat update app).
alter table public.families
  add column if not exists family_broadcast_message text;

comment on column public.families.family_broadcast_message is
  'Pesan singkat ortu ke kartu Energi & hero anak; null = pakai default aplikasi.';
