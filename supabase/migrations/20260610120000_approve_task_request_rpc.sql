-- Ortu menyetujui pengajuan ide misi: buat baris `tasks` dan tutup `task_requests`.

create or replace function public.approve_task_request (
  p_request_id uuid,
  p_reward_points int default 2,
  p_category public.task_category default 'lainnya',
  p_max_submissions_per_period int default 1,
  p_frequency_type public.frequency_type default 'daily'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_title text;
  v_task_id uuid;
  v_updated uuid;
begin
  if public.current_account_role() is distinct from 'primary_parent'
     and public.current_account_role() is distinct from 'secondary_parent' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  if coalesce(p_reward_points, 0) < 1 then
    raise exception 'invalid_reward' using errcode = 'P0001';
  end if;

  if coalesce(p_max_submissions_per_period, 0) < 1 then
    raise exception 'invalid_max_submissions' using errcode = 'P0001';
  end if;

  select tr.profile_id, trim(tr.title)
    into v_profile_id, v_title
  from public.task_requests tr
  join public.child_profiles c on c.id = tr.profile_id
  where tr.id = p_request_id
    and tr.status = 'pending'
    and c.family_id = public.current_family_id();

  if v_profile_id is null or char_length(coalesce(v_title, '')) = 0 then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.tasks (
    profile_id,
    title,
    category,
    reward_points,
    frequency_type,
    frequency_config,
    max_submissions_per_period,
    is_active
  )
  values (
    v_profile_id,
    v_title,
    p_category,
    p_reward_points,
    p_frequency_type,
    '{}'::jsonb,
    p_max_submissions_per_period,
    true
  )
  returning id into v_task_id;

  update public.task_requests tr
  set
    status = 'approved',
    created_task_id = v_task_id,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where tr.id = p_request_id
    and tr.status = 'pending'
  returning tr.id into v_updated;

  if v_updated is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  return v_task_id;
end;
$$;

revoke all on function public.approve_task_request (
  uuid,
  int,
  public.task_category,
  int,
  public.frequency_type
) from public;

grant execute on function public.approve_task_request (
  uuid,
  int,
  public.task_category,
  int,
  public.frequency_type
) to authenticated;

comment on function public.approve_task_request (
  uuid,
  int,
  public.task_category,
  int,
  public.frequency_type
) is
  'Ortu: setujui pengajuan ide misi dari anak — buat tasks aktif dan tutup permintaan.';
