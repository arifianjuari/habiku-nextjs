-- Anak mengajukan target beserta besaran energi.
-- Ortu tetap meninjau lewat approve_goal_request / reject_goal_request
-- dan boleh menyesuaikan HP sebelum goal dibuat.

alter table public.goal_requests
  add column if not exists requested_target_hp int;

alter table public.goal_requests
  drop constraint if exists goal_requests_requested_target_hp_positive;

alter table public.goal_requests
  add constraint goal_requests_requested_target_hp_positive
  check (requested_target_hp is null or requested_target_hp >= 1);

comment on column public.goal_requests.requested_target_hp is
  'Besaran energi yang diusulkan anak. Null hanya untuk pengajuan lama sebelum kolom ini ada.';

comment on table public.goal_requests is
  'Pengajuan hadiah/target dari mode anak, termasuk usulan energi. Ortu meninjau lalu membuat baris goals.';

create or replace function public.submit_goal_request (
  p_profile_id uuid,
  p_title text,
  p_requested_target_hp int,
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
  v_title text;
  v_note text;
  v_hp int;
  v_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if char_length(v_title) = 0 then
    raise exception 'title_required' using errcode = 'P0001';
  end if;
  if char_length(v_title) > 120 then
    raise exception 'title_too_long' using errcode = 'P0001';
  end if;

  v_hp := coalesce(p_requested_target_hp, 0);
  if v_hp < 1 or v_hp > 100000 then
    raise exception 'invalid_hp' using errcode = 'P0001';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = p_profile_id
    and c.archived_at is null;

  if v_family_id is null then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.accounts a
    where a.id = v_user
      and a.family_id = v_family_id
  ) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'note_too_long' using errcode = 'P0001';
  end if;

  insert into public.goal_requests (
    profile_id,
    title,
    note,
    requested_target_hp,
    status
  )
  values (
    p_profile_id,
    v_title,
    v_note,
    v_hp,
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_goal_request (uuid, text, int, text) from public;
grant execute on function public.submit_goal_request (uuid, text, int, text) to authenticated;

comment on function public.submit_goal_request (uuid, text, int, text) is
  'Mode anak: ajukan target hadiah beserta besaran energi. Menunggu tinjauan ortu.';

create or replace function public.notify_parents_on_goal_request_pending ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child_name text;
  v_family_id uuid;
  v_title text;
  v_hp_text text;
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
    v_title := 'Target';
  end if;

  v_hp_text := '';
  if new.requested_target_hp is not null then
    v_hp_text := ' (' || new.requested_target_hp::text || ' energi)';
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
      'goal_request_pending',
      coalesce(v_child_name, 'Anak') || ' mengajukan target: ' || v_title || v_hp_text
    );
  end loop;

  return new;
end;
$$;
