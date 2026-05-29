-- Unggah ke bucket `task-evidence` gagal: "new row violates row-level security policy".
-- Subquery ke `tasks` + `child_profiles` di policy `storage.objects` (sama kasusnya dengan
-- child-avatars / goal-images) sering tidak memenuhi predikat karena evaluasi RLS di subquery.
-- Helper security definer memeriksa path `<task_id>/...` sambil mengekang ke `current_family_id()`.

create or replace function public.storage_task_evidence_path_allowed (p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks t
    join public.child_profiles c on c.id = t.profile_id
    where t.id::text = split_part(ltrim(p_object_name, '/'), '/', 1)
      and c.family_id = public.current_family_id()
  );
$$;

revoke all on function public.storage_task_evidence_path_allowed (text) from public;
grant execute on function public.storage_task_evidence_path_allowed (text) to authenticated;

comment on function public.storage_task_evidence_path_allowed (text) is
  'RLS storage bucket task-evidence: objek `name` harus {task_id}/... dan task anak di keluarga saat ini.';

drop policy if exists "task_evidence_select_family" on storage.objects;
drop policy if exists "task_evidence_insert_family" on storage.objects;
drop policy if exists "task_evidence_update_family" on storage.objects;
drop policy if exists "task_evidence_delete_family" on storage.objects;

create policy "task_evidence_select_family"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'task-evidence'
    and public.storage_task_evidence_path_allowed (name)
  );

create policy "task_evidence_insert_family"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'task-evidence'
    and public.storage_task_evidence_path_allowed (name)
  );

create policy "task_evidence_update_family"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'task-evidence'
    and public.storage_task_evidence_path_allowed (name)
  )
  with check (
    bucket_id = 'task-evidence'
    and public.storage_task_evidence_path_allowed (name)
  );

create policy "task_evidence_delete_family"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'task-evidence'
    and public.storage_task_evidence_path_allowed (name)
  );
