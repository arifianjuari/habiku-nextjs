-- Pengajuan target/hadiah dari anak; orang tua menetapkan HP lalu menyetujui (selaras prototipe).
-- Idempoten: aman bila tipe / tabel sudah terbentuk dari percobaan migrasi sebelumnya.

do $migration$
begin
  if not exists (
    select 1
    from pg_catalog.pg_type t
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'goal_request_status'
  ) then
    create type public.goal_request_status as enum ('pending', 'approved', 'rejected');
  end if;
end;
$migration$;

create table if not exists public.goal_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  title text not null,
  note text,
  status public.goal_request_status not null default 'pending',
  created_goal_id uuid references public.goals (id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goal_requests_title_nontrivial check (char_length(trim(title)) > 0)
);

create index if not exists goal_requests_profile_id_idx on public.goal_requests (profile_id);
create index if not exists goal_requests_profile_pending_idx on public.goal_requests (profile_id) where (status = 'pending');

comment on table public.goal_requests is
  'Pengajuan hadiah/target dari alur mode anak; ortu meninjau, menetapkan HP, lalu membuat baris goals.';

alter table public.goal_requests enable row level security;

drop policy if exists "goal_requests_select_family" on public.goal_requests;
create policy "goal_requests_select_family"
  on public.goal_requests
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      where c.family_id = public.current_family_id()
    )
  );

drop policy if exists "goal_requests_insert_parent" on public.goal_requests;
create policy "goal_requests_insert_parent"
  on public.goal_requests
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

drop policy if exists "goal_requests_update_parent" on public.goal_requests;
create policy "goal_requests_update_parent"
  on public.goal_requests
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

-- ---------------------------------------------------------------------------
-- RPC: setujui (buat goal + tutup permintaan) / tolak — atomi & cek ortu
-- ---------------------------------------------------------------------------

create or replace function public.approve_goal_request (p_request_id uuid, p_target_hp int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_title text;
  v_goal_id uuid;
begin
  if p_target_hp is null or p_target_hp < 1 then
    raise exception 'invalid_hp' using errcode = 'P0001';
  end if;

  if public.current_account_role() is distinct from 'primary_parent'
     and public.current_account_role() is distinct from 'secondary_parent' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select gr.profile_id, gr.title
  into v_profile_id, v_title
  from public.goal_requests gr
  join public.child_profiles c on c.id = gr.profile_id
  where gr.id = p_request_id
    and gr.status = 'pending'
    and c.family_id = public.current_family_id();

  if v_profile_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.goals (profile_id, title, target_hp, current_hp, status)
  values (v_profile_id, trim(both from v_title), p_target_hp, 0, 'active')
  returning id into v_goal_id;

  update public.goal_requests
  set
    status = 'approved',
    created_goal_id = v_goal_id,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = p_request_id;

  return v_goal_id;
end;
$$;

create or replace function public.reject_goal_request (p_request_id uuid)
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

  update public.goal_requests gr
  set
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  from public.child_profiles c
  where gr.id = p_request_id
    and gr.status = 'pending'
    and c.id = gr.profile_id
    and c.family_id = public.current_family_id()
  returning gr.id into v_id;

  if v_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.approve_goal_request (uuid, int) from public;
grant execute on function public.approve_goal_request (uuid, int) to authenticated;

revoke all on function public.reject_goal_request (uuid) from public;
grant execute on function public.reject_goal_request (uuid) to authenticated;

comment on function public.approve_goal_request (uuid, int) is
  'Ortu: setujui pengajuan anak, buat goals aktif, tandai permintaan disetujui.';

comment on function public.reject_goal_request (uuid) is
  'Ortu: tolak pengajuan target (tetap tercatat).';
