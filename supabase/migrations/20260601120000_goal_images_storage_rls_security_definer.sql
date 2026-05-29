-- Unggah ke bucket `goal-images` gagal: "new row violates row-level security policy".
-- Subquery `goals` + `child_profiles` di policy `storage.objects` (seperti child-avatars)
-- sering tidak memenuhi predikat karena evaluasi RLS di subquery. Helper security definer
-- memeriksa path `<goal_id>/...` sambil mengekang ke `current_family_id()`.

create or replace function public.storage_goal_image_path_allowed (p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.goals g
    join public.child_profiles c on c.id = g.profile_id
    where g.id::text = split_part(ltrim(p_object_name, '/'), '/', 1)
      and c.family_id = public.current_family_id()
  );
$$;

revoke all on function public.storage_goal_image_path_allowed (text) from public;
grant execute on function public.storage_goal_image_path_allowed (text) to authenticated;

comment on function public.storage_goal_image_path_allowed (text) is
  'RLS storage bucket goal-images: objek `name` harus {goal_id}/... dan goal anak di keluarga saat ini.';

drop policy if exists "goal_images_select_family" on storage.objects;
drop policy if exists "goal_images_insert_family" on storage.objects;
drop policy if exists "goal_images_update_family" on storage.objects;
drop policy if exists "goal_images_delete_family" on storage.objects;

create policy "goal_images_select_family"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'goal-images'
    and public.storage_goal_image_path_allowed (name)
  );

create policy "goal_images_insert_family"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'goal-images'
    and public.storage_goal_image_path_allowed (name)
  );

create policy "goal_images_update_family"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'goal-images'
    and public.storage_goal_image_path_allowed (name)
  )
  with check (
    bucket_id = 'goal-images'
    and public.storage_goal_image_path_allowed (name)
  );

create policy "goal_images_delete_family"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'goal-images'
    and public.storage_goal_image_path_allowed (name)
  );
