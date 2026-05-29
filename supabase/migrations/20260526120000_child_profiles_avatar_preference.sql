-- Preferensi tampil avatar: foto (storage) vs emoji; emoji kustom opsional.
-- Anak yang sudah punya foto: default ke «photo» agar perilaku lama dipertahankan.

alter table public.child_profiles
  add column if not exists avatar_preference text not null default 'emoji'
  constraint child_profiles_avatar_preference_check
  check (avatar_preference in ('photo', 'emoji'));

alter table public.child_profiles
  add column if not exists avatar_emoji text
  constraint child_profiles_avatar_emoji_len
  check (avatar_emoji is null or (char_length(trim(avatar_emoji)) >= 1 and char_length(avatar_emoji) <= 16));

update public.child_profiles
set avatar_preference = 'photo'
where avatar_url is not null
  and avatar_preference = 'emoji';

comment on column public.child_profiles.avatar_preference is
  'Kartu UI: tampilkan foto Storage (photo) atau emoji (emoji).';
comment on column public.child_profiles.avatar_emoji is
  'Emoji pilihan ortu; jika null, UI fallback ke daftar per indeks.';
