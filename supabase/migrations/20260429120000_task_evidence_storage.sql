-- Fase 4: bukti foto misi (Storage privat), path `<task_id>/<uuid>.webp`

insert into storage.buckets (id, name, public)
values ('task-evidence', 'task-evidence', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "task_evidence_select_family" on storage.objects;
drop policy if exists "task_evidence_insert_family" on storage.objects;
drop policy if exists "task_evidence_update_family" on storage.objects;
drop policy if exists "task_evidence_delete_family" on storage.objects;

-- Path: segment pertama = tasks.id
create policy "task_evidence_select_family"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'task-evidence'
    and exists (
      select 1
      from public.tasks t
      join public.child_profiles c on c.id = t.profile_id
      where t.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  );

create policy "task_evidence_insert_family"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'task-evidence'
    and exists (
      select 1
      from public.tasks t
      join public.child_profiles c on c.id = t.profile_id
      where t.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  );

create policy "task_evidence_update_family"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'task-evidence'
    and exists (
      select 1
      from public.tasks t
      join public.child_profiles c on c.id = t.profile_id
      where t.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  )
  with check (
    bucket_id = 'task-evidence'
    and exists (
      select 1
      from public.tasks t
      join public.child_profiles c on c.id = t.profile_id
      where t.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  );

create policy "task_evidence_delete_family"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'task-evidence'
    and exists (
      select 1
      from public.tasks t
      join public.child_profiles c on c.id = t.profile_id
      where t.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  );
