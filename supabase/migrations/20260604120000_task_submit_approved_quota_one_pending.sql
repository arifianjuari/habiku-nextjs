-- Kuota periode = jumlah yang **sudah disetujui ortu** (approved), bukan jumlah pengajuan pending.
-- Satu misi hanya boleh punya satu baris task_history pending pada satu waktu:
-- pengajuan berikutnya baru setelah ortu menyetujui atau menolak yang sebelumnya.

create or replace function public.task_submissions_in_period (p_task_id uuid, p_profile_id uuid)
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
      and th.status = 'approved'
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
      and th.status = 'approved'
      and (timezone (coalesce(v_tz, 'UTC'), th.completed_at))::date
        = (timezone (coalesce(v_tz, 'UTC'), now()))::date;
  end if;

  return v_count;
end;
$$;

create or replace function public.assert_can_submit_task (p_task_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_active boolean;
  v_cnt int;
  v_has_pending boolean;
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

  select exists (
    select 1
    from public.task_history th
    where th.task_id = p_task_id
      and th.profile_id = p_profile_id
      and th.status = 'pending'
  )
  into v_has_pending;

  if v_has_pending then
    raise exception 'pending_submission_exists' using errcode = 'P0001';
  end if;

  v_cnt := public.task_submissions_in_period(p_task_id, p_profile_id);

  if v_cnt >= v_max then
    raise exception 'submission_limit_reached: %/%', v_cnt, v_max
      using errcode = 'P0001';
  end if;
end;
$$;

comment on function public.task_submissions_in_period (uuid, uuid) is
  'Jumlah penyelesaian yang sudah disetujui ortu (approved) di periode berjalan — harian/mingguan, timezone keluarga.';

comment on function public.assert_can_submit_task (uuid, uuid) is
  'Sebelum insert task_history pending: misi aktif, belum ada pending lain untuk task ini, kuota approved di periode < max.';
