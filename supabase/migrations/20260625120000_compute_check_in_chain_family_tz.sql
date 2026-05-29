-- Rantai check-in: «hari ini» selalu dari timezone keluarga (bukan tanggal UTC dari klien).

create or replace function public.compute_check_in_chain_length (p_profile_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with ctx as (
    select (timezone(coalesce(f.timezone, 'UTC'), now()))::date as today
    from public.child_profiles cp
    join public.families f on f.id = cp.family_id
    where cp.id = p_profile_id
  ),
  consecutive as (
    select check_in_date,
           (select today from ctx) - check_in_date as gap
    from public.daily_check_ins
    where profile_id = p_profile_id
      and check_in_date <= (select today from ctx)
      and check_in_date > (select today from ctx) - interval '60 days'
    order by check_in_date desc
  ),
  numbered as (
    select check_in_date,
           gap,
           row_number() over (order by check_in_date desc) - 1 as expected_gap
    from consecutive
  )
  select count(*)::int
  from numbered
  where gap = expected_gap;
$$;

drop function if exists public.compute_check_in_chain_length (uuid, date);

revoke all on function public.compute_check_in_chain_length (uuid) from public;
grant execute on function public.compute_check_in_chain_length (uuid) to authenticated;

comment on function public.compute_check_in_chain_length (uuid) is
  'Panjang rantai check-in berturut yang berakhir di hari kalender keluarga (max 60 hari; timezone dari families.timezone).';

-- Samakan pemanggilan internal award_daily_checkin_bonus.
create or replace function public.award_daily_checkin_bonus (p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_tz text;
  v_today date;
  v_existing record;
  v_ledger_id uuid;
  v_check_id uuid;
  v_chain_len int;
  v_bonus int;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = p_profile_id;
  if v_family_id is null then
    raise exception 'profile_not_found' using errcode = 'P0001';
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

  v_tz := (select f.timezone from public.families f where f.id = v_family_id);
  v_today := (timezone (coalesce (v_tz, 'UTC'), now ()))::date;

  select fs.daily_check_in_bonus into v_bonus
  from public.family_settings fs
  where fs.family_id = v_family_id;
  if v_bonus is null then
    v_bonus := 2;
  end if;
  if v_bonus not in (1, 2, 3, 5, 10) then
    v_bonus := 2;
  end if;

  select id, bonus_awarded into v_existing
  from public.daily_check_ins
  where profile_id = p_profile_id
    and check_in_date = v_today
  limit 1;
  if found then
    v_chain_len := public.compute_check_in_chain_length (p_profile_id);
    return jsonb_build_object(
      'already', true,
      'bonus', 0,
      'chain_length', v_chain_len,
      'check_in_date', v_today::text
    );
  end if;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (p_profile_id, v_user, v_bonus, 'bonus_checkin', null)
  returning id into v_ledger_id;

  insert into public.daily_check_ins (profile_id, check_in_date, bonus_awarded, ledger_id)
  values (p_profile_id, v_today, v_bonus, v_ledger_id)
  on conflict (profile_id, check_in_date) do nothing
  returning id into v_check_id;

  if v_check_id is null then
    delete from public.point_ledger where id = v_ledger_id;
    v_chain_len := public.compute_check_in_chain_length (p_profile_id);
    return jsonb_build_object(
      'already', true,
      'bonus', 0,
      'chain_length', v_chain_len,
      'check_in_date', v_today::text
    );
  end if;

  v_chain_len := public.compute_check_in_chain_length (p_profile_id);
  return jsonb_build_object(
    'already', false,
    'bonus', v_bonus,
    'chain_length', v_chain_len,
    'check_in_date', v_today::text
  );
end;
$$;
