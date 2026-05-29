-- Unggah ke bucket `child-avatars` gagal dengan "new row violates row-level security policy".
-- Subquery ke `public.child_profiles` di dalam policy `storage.objects` sering tidak memenuhi
-- predikat (konteks RLS / evaluasi); helper ini memeriksa path `profileId/...` dengan
-- security definer sambil tetap mengekang ke keluarga ortu: `current_family_id()`.

create or replace function public.storage_child_avatar_path_allowed (p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.child_profiles c
    where c.id::text = split_part(p_object_name, '/', 1)
      and c.family_id = public.current_family_id()
  );
$$;

revoke all on function public.storage_child_avatar_path_allowed (text) from public;
grant execute on function public.storage_child_avatar_path_allowed (text) to authenticated;

comment on function public.storage_child_avatar_path_allowed (text) is
  'RLS storage bucket child-avatars: objek `name` harus {child_profile_id}/... di keluarga saat ini.';

drop policy if exists "child_avatars_select_family" on storage.objects;
drop policy if exists "child_avatars_insert_family" on storage.objects;
drop policy if exists "child_avatars_update_family" on storage.objects;
drop policy if exists "child_avatars_delete_family" on storage.objects;

create policy "child_avatars_select_family"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'child-avatars'
    and public.storage_child_avatar_path_allowed (name)
  );

create policy "child_avatars_insert_family"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'child-avatars'
    and public.storage_child_avatar_path_allowed (name)
  );

create policy "child_avatars_update_family"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'child-avatars'
    and public.storage_child_avatar_path_allowed (name)
  )
  with check (
    bucket_id = 'child-avatars'
    and public.storage_child_avatar_path_allowed (name)
  );

create policy "child_avatars_delete_family"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'child-avatars'
    and public.storage_child_avatar_path_allowed (name)
  );
