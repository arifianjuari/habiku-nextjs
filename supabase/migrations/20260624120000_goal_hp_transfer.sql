-- Realokasi HP antar target aktif milik satu profil anak (ortu).
-- Tidak menulis point_ledger / goal_progress_events — hanya memindahkan current_hp.

create table public.goal_hp_transfers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  from_goal_id uuid not null references public.goals (id) on delete restrict,
  to_goal_id uuid not null references public.goals (id) on delete restrict,
  amount int not null check (amount > 0),
  initiated_by_account_id uuid references public.accounts (id) on delete set null,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  check (from_goal_id <> to_goal_id)
);

create index goal_hp_transfers_profile_id_idx
  on public.goal_hp_transfers (profile_id, created_at desc);

comment on table public.goal_hp_transfers is
  'Jejak realokasi HP antar target aktif; ditulis oleh RPC transfer_goal_hp.';

alter table public.goal_hp_transfers enable row level security;

create policy goal_hp_transfers_select_family on public.goal_hp_transfers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = goal_hp_transfers.profile_id
        and a.id = auth.uid()
    )
  );

revoke insert, update, delete on public.goal_hp_transfers from public;

-- ---------------------------------------------------------------------------
-- RPC: transfer_goal_hp
-- ---------------------------------------------------------------------------

create or replace function public.transfer_goal_hp (
  p_profile_id uuid,
  p_from_goal_id uuid,
  p_to_goal_id uuid,
  p_amount int,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_note text;
  v_amount int;
  v_from public.goals%rowtype;
  v_to public.goals%rowtype;
  v_room int;
  v_to_new int;
  v_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if p_from_goal_id is null or p_to_goal_id is null then
    raise exception 'goal_required' using errcode = 'P0001';
  end if;

  if p_from_goal_id = p_to_goal_id then
    raise exception 'same_goal' using errcode = 'P0001';
  end if;

  v_amount := coalesce(p_amount, 0);
  if v_amount < 1 then
    raise exception 'amount_required' using errcode = 'P0001';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 200 then
    v_note := substring(v_note from 1 for 200);
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = p_profile_id;
  if v_family_id is null then
    raise exception 'profile_not_found';
  end if;

  if not exists (
    select 1
    from public.accounts a
    where a.id = v_user
      and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_from
  from public.goals
  where id = p_from_goal_id
    and profile_id = p_profile_id
    and status = 'active'
  for update;
  if not found then
    raise exception 'invalid_from_goal' using errcode = 'P0001';
  end if;

  select * into v_to
  from public.goals
  where id = p_to_goal_id
    and profile_id = p_profile_id
    and status = 'active'
  for update;
  if not found then
    raise exception 'invalid_to_goal' using errcode = 'P0001';
  end if;

  if v_from.current_hp < v_amount then
    raise exception 'insufficient_hp' using errcode = 'P0001';
  end if;

  v_room := greatest(0, v_to.target_hp - v_to.current_hp);
  if v_amount > v_room then
    raise exception 'destination_full' using errcode = 'P0001';
  end if;

  update public.goals
  set
    current_hp = current_hp - v_amount,
    updated_at = now()
  where id = v_from.id;

  v_to_new := v_to.current_hp + v_amount;
  update public.goals
  set
    current_hp = v_to_new,
    status = case when v_to_new >= target_hp then 'completed'::public.goal_status else status end,
    updated_at = now()
  where id = v_to.id;

  insert into public.goal_hp_transfers (
    profile_id,
    from_goal_id,
    to_goal_id,
    amount,
    initiated_by_account_id,
    note
  )
  values (
    p_profile_id,
    v_from.id,
    v_to.id,
    v_amount,
    v_user,
    v_note
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.transfer_goal_hp (uuid, uuid, uuid, int, text) from public;

grant execute on function public.transfer_goal_hp (uuid, uuid, uuid, int, text) to authenticated;
