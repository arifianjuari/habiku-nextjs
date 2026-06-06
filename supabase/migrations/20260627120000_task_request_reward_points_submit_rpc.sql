-- Kolom energi yang diminta anak + RPC pengajuan dari mode anak.

alter table public.task_requests
  add column if not exists requested_reward_points int not null default 5;

alter table public.task_requests
  drop constraint if exists task_requests_reward_positive;

alter table public.task_requests
  add constraint task_requests_reward_positive check (requested_reward_points >= 1);

comment on column public.task_requests.requested_reward_points is
  'Besaran energi (E) yang diajukan anak; ortu dapat menyesuaikan saat menyetujui.';

-- ---------------------------------------------------------------------------
-- Anak (via sesi ortu + mode anak): ajukan ide misi baru.
-- ---------------------------------------------------------------------------

create or replace function public.submit_task_request (
  p_profile_id uuid,
  p_title text,
  p_note text default null,
  p_requested_reward_points int default 5
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
  v_reward int;
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

  v_reward := greatest(0, coalesce(p_requested_reward_points, 0));
  if v_reward < 1 then
    raise exception 'invalid_reward' using errcode = 'P0001';
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

  if exists (
    select 1
    from public.task_requests tr
    where tr.profile_id = p_profile_id
      and tr.status = 'pending'
  ) then
    raise exception 'pending_exists' using errcode = 'P0001';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');

  insert into public.task_requests (
    profile_id,
    title,
    note,
    requested_reward_points,
    status
  )
  values (
    p_profile_id,
    v_title,
    v_note,
    v_reward,
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_task_request (uuid, text, text, int) from public;
grant execute on function public.submit_task_request (uuid, text, text, int) to authenticated;

comment on function public.submit_task_request (uuid, text, text, int) is
  'Ajukan ide misi dari mode anak; satu pengajuan pending per profil anak.';
