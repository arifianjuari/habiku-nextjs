-- Kolom yang dibutuhkan fungsi (ditambahkan di sini agar urutan migrasi lokal konsisten).
alter table public.families
  add column if not exists family_broadcast_message text;

alter table public.child_profiles
  add column if not exists parent_sticky_message text;

-- Baca pesan sticky yang dilihat anak (parent_sticky_message > family_broadcast_message).
create or replace function public.get_child_sticky_message (p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(
    trim(both from coalesce(
      nullif(trim(both from coalesce(c.parent_sticky_message, '')), ''),
      nullif(trim(both from coalesce(f.family_broadcast_message, '')), '')
    )),
    ''
  )
  from public.child_profiles c
  join public.families f on f.id = c.family_id
  where c.id = p_profile_id
    and c.family_id = public.current_family_id();
$$;

revoke all on function public.get_child_sticky_message (uuid) from public;
grant execute on function public.get_child_sticky_message (uuid) to authenticated;

comment on function public.get_child_sticky_message (uuid) is
  'Beranda anak: sticky pribadi mengutamakan pesan broadcast keluarga; null jika kosong.';
