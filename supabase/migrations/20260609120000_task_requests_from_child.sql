-- Pengajuan ide misi dari mode anak; ortu meninjau lalu bisa membuat baris `tasks` (alur lanjutan).
-- Memakai enum `goal_request_status` yang sama (pending / approved / rejected) untuk konsistensi.

create table if not exists public.task_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  title text not null,
  note text,
  status public.goal_request_status not null default 'pending',
  created_task_id uuid references public.tasks (id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_requests_title_nontrivial check (char_length(trim(title)) > 0)
);

create index if not exists task_requests_profile_id_idx on public.task_requests (profile_id);
create index if not exists task_requests_profile_pending_idx on public.task_requests (profile_id) where (status = 'pending');

comment on table public.task_requests is
  'Pengajuan ide misi dari alur mode anak; ortu meninjau dan menyetujui dengan membuat misi resmi (tasks).';

alter table public.task_requests enable row level security;

drop policy if exists "task_requests_select_family" on public.task_requests;
create policy "task_requests_select_family"
  on public.task_requests
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

drop policy if exists "task_requests_insert_parent" on public.task_requests;
create policy "task_requests_insert_parent"
  on public.task_requests
  for insert
  to authenticated
  with check (
    public.current_account_role() in ('primary_parent', 'secondary_parent')
    and profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

drop policy if exists "task_requests_update_parent" on public.task_requests;
create policy "task_requests_update_parent"
  on public.task_requests
  for update
  to authenticated
  using (
    public.current_account_role() in ('primary_parent', 'secondary_parent')
    and profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  )
  with check (
    public.current_account_role() in ('primary_parent', 'secondary_parent')
    and profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

grant select, insert, update on public.task_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Notifikasi in-app ke ortu saat pengajuan misi (pending).
-- ---------------------------------------------------------------------------

create or replace function public.notify_parents_on_task_request_pending ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child_name text;
  v_family_id uuid;
  v_title text;
  r record;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  select c.family_id, c.name
    into v_family_id, v_child_name
  from public.child_profiles c
  where c.id = new.profile_id;

  v_title := left(trim(coalesce(new.title, '')), 200);
  if v_title = '' then
    v_title := 'Misi';
  end if;

  for r in
    select a.id as account_id
    from public.accounts a
    where a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  loop
    insert into public.notifications (recipient_id, recipient_type, type, content)
    values (
      r.account_id,
      'account',
      'task_request_pending',
      coalesce(v_child_name, 'Anak') || ' mengajukan ide misi: ' || v_title
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_task_requests_notify_parents on public.task_requests;
create trigger trg_task_requests_notify_parents
  after insert on public.task_requests
  for each row
  execute function public.notify_parents_on_task_request_pending ();

comment on function public.notify_parents_on_task_request_pending () is
  'Insert notifications (recipient account) saat pengajuan misi dari anak (pending).';

-- ---------------------------------------------------------------------------
-- Ortu: tolak pengajuan ide misi.
-- ---------------------------------------------------------------------------

create or replace function public.reject_task_request (p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if public.current_account_role() is distinct from 'primary_parent'
     and public.current_account_role() is distinct from 'secondary_parent' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  update public.task_requests tr
  set
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  from public.child_profiles c
  where tr.id = p_request_id
    and tr.status = 'pending'
    and c.id = tr.profile_id
    and c.family_id = public.current_family_id()
  returning tr.id into v_id;

  if v_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.reject_task_request (uuid) from public;
grant execute on function public.reject_task_request (uuid) to authenticated;

comment on function public.reject_task_request (uuid) is
  'Ortu: tolak pengajuan ide misi dari anak (tetap tercatat).';
