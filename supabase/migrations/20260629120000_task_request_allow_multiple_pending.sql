-- Izinkan beberapa pengajuan misi pending per anak.

create or replace function public.submit_task_request (
  p_profile_id uuid,
  p_title text,
  p_note text default null,
  p_requested_reward_points int default 5,
  p_requested_frequency_type public.frequency_type default 'daily',
  p_requested_max_submissions_per_period int default 1
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
  v_max int;
  v_freq public.frequency_type;
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

  v_max := greatest(0, coalesce(p_requested_max_submissions_per_period, 0));
  if v_max < 1 or v_max > 20 then
    raise exception 'invalid_max_submissions' using errcode = 'P0001';
  end if;

  v_freq := coalesce(p_requested_frequency_type, 'daily');
  if v_freq not in ('daily', 'weekly') then
    raise exception 'invalid_frequency' using errcode = 'P0001';
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

  insert into public.task_requests (
    profile_id,
    title,
    note,
    requested_reward_points,
    requested_frequency_type,
    requested_max_submissions_per_period,
    status
  )
  values (
    p_profile_id,
    v_title,
    v_note,
    v_reward,
    v_freq,
    v_max,
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.submit_task_request (
  uuid,
  text,
  text,
  int,
  public.frequency_type,
  int
) is
  'Ajukan ide misi dari mode anak; boleh lebih dari satu pengajuan pending per profil.';
