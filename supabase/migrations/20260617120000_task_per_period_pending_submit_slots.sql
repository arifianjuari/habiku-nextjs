-- Misi dengan max_submissions_per_period > 1: anak boleh mengirim pengajuan baru selama
-- (jumlah approved + pending dalam periode) < max. Kuota periode = "slot" yang dipakai;
-- pending lama dari hari lain tidak menghitung di periode hari ini (sama seperti hitung approved).

create or replace function public.task_pending_submissions_in_period (p_task_id uuid, p_profile_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count int;
  v_family_id uuid;
  v_tz text;
  v_ft public.frequency_type;
begin
  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = p_profile_id;
  if v_family_id is null then
    return 0;
  end if;
  v_tz := (select f.timezone from public.families f where f.id = v_family_id);

  select t.frequency_type into v_ft
  from public.tasks t
  where t.id = p_task_id
    and t.profile_id = p_profile_id;

  if v_ft is null then
    return 0;
  end if;

  if v_ft = 'weekly' then
    select count(*)::int into v_count
    from public.task_history th
    where th.task_id = p_task_id
      and th.profile_id = p_profile_id
      and th.status = 'pending'
      and date_trunc(
        'week',
        (timezone (coalesce(v_tz, 'UTC'), th.completed_at))
      )::date
      = date_trunc(
        'week',
        (timezone (coalesce(v_tz, 'UTC'), now()))
      )::date;
  else
    select count(*)::int into v_count
    from public.task_history th
    where th.task_id = p_task_id
      and th.profile_id = p_profile_id
      and th.status = 'pending'
      and (timezone (coalesce(v_tz, 'UTC'), th.completed_at))::date
        = (timezone (coalesce(v_tz, 'UTC'), now()))::date;
  end if;

  return v_count;
end;
$$;

comment on function public.task_pending_submissions_in_period (uuid, uuid) is
  'Jumlah pengajuan task_history pending di periode berjalan (harian/mingguan, TZ keluarga; custom = harian).';

revoke all on function public.task_pending_submissions_in_period (uuid, uuid) from public;
grant execute on function public.task_pending_submissions_in_period (uuid, uuid) to authenticated;

create or replace function public.assert_can_submit_task (p_task_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_active boolean;
  v_approved int;
  v_pending int;
begin
  select t.max_submissions_per_period, t.is_active
  into v_max, v_active
  from public.tasks t
  where t.id = p_task_id
    and t.profile_id = p_profile_id;

  if v_max is null then
    raise exception 'task_not_found' using errcode = 'P0001';
  end if;

  if not v_active then
    raise exception 'task_inactive' using errcode = 'P0001';
  end if;

  v_approved := public.task_submissions_in_period(p_task_id, p_profile_id);
  if v_approved >= v_max then
    raise exception 'submission_limit_reached: %/%', v_approved, v_max
      using errcode = 'P0001';
  end if;

  v_pending := public.task_pending_submissions_in_period(p_task_id, p_profile_id);
  if v_approved + v_pending >= v_max then
    raise exception 'pending_submission_exists' using errcode = 'P0001';
  end if;
end;
$$;

comment on function public.assert_can_submit_task (uuid, uuid) is
  'Sebelum insert task_history pending: misi aktif, approved+pending di periode < max.';
