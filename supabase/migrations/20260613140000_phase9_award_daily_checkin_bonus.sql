-- Habiku Fase 9.1 — RPC `award_daily_checkin_bonus` (idempotent harian).
-- Sesi auth pemanggil = ortu (primary/secondary) di keluarga anak; di Child Mode
-- anak tetap memakai sesi ortu yang sama (PIN dijaga di klien).
--
-- Output JSON:
--   { already: bool, bonus: int, chain_length: int, check_in_date: text }
-- - `already=true` bila bonus untuk hari ini sudah pernah diberikan; tidak
--   menambah ledger maupun row baru.
-- - `chain_length` = jumlah hari berturut yang berakhir tepat di hari ini
--   pada timezone keluarga (mengandalkan tabel `daily_check_ins`).

create or replace function public.award_daily_checkin_bonus (
  p_profile_id uuid
)
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
  v_bonus int := 2;
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

  -- Akses: ortu di keluarga yang sama (anak memakai sesi ortu di Child Mode).
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

  -- Sudah klaim hari ini? -> idempotent, tidak menambah ledger.
  select id, bonus_awarded into v_existing
  from public.daily_check_ins
  where profile_id = p_profile_id
    and check_in_date = v_today
  limit 1;
  if found then
    v_chain_len := public.compute_check_in_chain_length (p_profile_id, v_today);
    return jsonb_build_object(
      'already', true,
      'bonus', 0,
      'chain_length', v_chain_len,
      'check_in_date', v_today::text
    );
  end if;

  -- Insert ledger bonus_checkin (account_id = ortu yang sedang sign-in).
  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (p_profile_id, v_user, v_bonus, 'bonus_checkin', null)
  returning id into v_ledger_id;

  insert into public.daily_check_ins (profile_id, check_in_date, bonus_awarded, ledger_id)
  values (p_profile_id, v_today, v_bonus, v_ledger_id)
  on conflict (profile_id, check_in_date) do nothing
  returning id into v_check_id;

  -- Race-safe: jika UNIQUE constraint menabrak (paralel klaim), rollback insert
  -- ledger di atas dan kembalikan jawaban "already".
  if v_check_id is null then
    delete from public.point_ledger where id = v_ledger_id;
    v_chain_len := public.compute_check_in_chain_length (p_profile_id, v_today);
    return jsonb_build_object(
      'already', true,
      'bonus', 0,
      'chain_length', v_chain_len,
      'check_in_date', v_today::text
    );
  end if;

  v_chain_len := public.compute_check_in_chain_length (p_profile_id, v_today);
  return jsonb_build_object(
    'already', false,
    'bonus', v_bonus,
    'chain_length', v_chain_len,
    'check_in_date', v_today::text
  );
end;
$$;

revoke all on function public.award_daily_checkin_bonus (uuid) from public;
grant execute on function public.award_daily_checkin_bonus (uuid) to authenticated;

comment on function public.award_daily_checkin_bonus (uuid) is
  'Bonus harian +2 (Fase 9.1) idempotent per (profil, tanggal kalender keluarga); insert point_ledger type=bonus_checkin & daily_check_ins.';

-- ---------------------------------------------------------------------------
-- Helper: hitung panjang rantai check-in berturut yang berakhir di hari ini.
-- ---------------------------------------------------------------------------
create or replace function public.compute_check_in_chain_length (
  p_profile_id uuid,
  p_today date
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with consecutive as (
    select check_in_date,
           p_today - check_in_date as gap
    from public.daily_check_ins
    where profile_id = p_profile_id
      and check_in_date <= p_today
      and check_in_date > p_today - interval '60 days'
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

revoke all on function public.compute_check_in_chain_length (uuid, date) from public;
grant execute on function public.compute_check_in_chain_length (uuid, date) to authenticated;

comment on function public.compute_check_in_chain_length (uuid, date) is
  'Panjang rantai check-in berturut yang berakhir di p_today (max 60 hari, timezone keluarga di-handle pemanggil).';
