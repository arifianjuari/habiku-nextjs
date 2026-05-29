-- Fase 3 penutup: Storage gambar goal + validasi batas submit (periode & timezone keluarga).

-- ---------------------------------------------------------------------------
-- Storage: gambar cover goal (privat), path "<goal_id>/cover.<ext>"
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('goal-images', 'goal-images', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "goal_images_select_family" on storage.objects;
drop policy if exists "goal_images_insert_family" on storage.objects;
drop policy if exists "goal_images_update_family" on storage.objects;
drop policy if exists "goal_images_delete_family" on storage.objects;

create policy "goal_images_select_family"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'goal-images'
    and exists (
      select 1
      from public.goals g
      join public.child_profiles c on c.id = g.profile_id
      where g.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  );

create policy "goal_images_insert_family"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'goal-images'
    and exists (
      select 1
      from public.goals g
      join public.child_profiles c on c.id = g.profile_id
      where g.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  );

create policy "goal_images_update_family"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'goal-images'
    and exists (
      select 1
      from public.goals g
      join public.child_profiles c on c.id = g.profile_id
      where g.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  )
  with check (
    bucket_id = 'goal-images'
    and exists (
      select 1
      from public.goals g
      join public.child_profiles c on c.id = g.profile_id
      where g.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  );

create policy "goal_images_delete_family"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'goal-images'
    and exists (
      select 1
      from public.goals g
      join public.child_profiles c on c.id = g.profile_id
      where g.id::text = split_part(name, '/', 1)
        and c.family_id = public.current_family_id()
    )
  );

-- ---------------------------------------------------------------------------
-- task_submissions_in_period: harian + mingguan (timezone keluarga); custom = harian (MVP)
-- ---------------------------------------------------------------------------

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
      and th.status in ('pending', 'approved')
      and date_trunc(
        'week',
        (timezone (coalesce(v_tz, 'UTC'), th.completed_at))
      )::date
      = date_trunc(
        'week',
        (timezone (coalesce(v_tz, 'UTC'), now()))
      )::date;
  else
    -- daily + custom (MVP): per hari kalender lokal keluarga
    select count(*)::int into v_count
    from public.task_history th
    where th.task_id = p_task_id
      and th.profile_id = p_profile_id
      and th.status in ('pending', 'approved')
      and (timezone (coalesce(v_tz, 'UTC'), th.completed_at))::date
        = (timezone (coalesce(v_tz, 'UTC'), now()))::date;
  end if;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- assert_can_submit_task: gagal jika sudah capai max_submissions_per_period
-- ---------------------------------------------------------------------------

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

  v_cnt := public.task_submissions_in_period(p_task_id, p_profile_id);

  if v_cnt >= v_max then
    raise exception 'submission_limit_reached: %/%', v_cnt, v_max
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.assert_can_submit_task (uuid, uuid) from public;
grant execute on function public.assert_can_submit_task (uuid, uuid) to authenticated;

comment on function public.assert_can_submit_task (uuid, uuid) is
  'Sebelum insert task_history (anak): pastikan belum melebihi max_submissions_per_period untuk periode berjalan.';
