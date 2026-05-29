-- Fase 9.1 enhancement: bonus check-in harian dapat diatur per keluarga.
-- Menambahkan kolom `daily_check_in_bonus` ke `family_settings`, memperbarui
-- RPC `award_daily_checkin_bonus` agar membaca nilai itu (fallback default 2),
-- dan menyamakan batas atas constraint `daily_check_ins.bonus_awarded`
-- (1..10) — domain UI yang ditawarkan adalah {1, 2, 3, 5, 10}.

-- ---------------------------------------------------------------------------
-- 1. Kolom baru di family_settings (idempotent)
-- ---------------------------------------------------------------------------

alter table public.family_settings
  add column if not exists daily_check_in_bonus int not null default 2;

-- Normalisasi nilai lama / NULL ke domain yang valid sebelum CHECK.
update public.family_settings
set daily_check_in_bonus = 2
where daily_check_in_bonus is null
   or daily_check_in_bonus not in (1, 2, 3, 5, 10);

alter table public.family_settings
  drop constraint if exists family_settings_daily_check_in_bonus_check;

alter table public.family_settings
  add constraint family_settings_daily_check_in_bonus_check
    check (daily_check_in_bonus in (1, 2, 3, 5, 10));

comment on column public.family_settings.daily_check_in_bonus is
  'Bonus poin harian saat anak klaim check-in (Fase 9.1). Domain: 1, 2, 3, 5, 10. Default 2.';

-- ---------------------------------------------------------------------------
-- 2. RPC award_daily_checkin_bonus — baca bonus dari family_settings.
-- ---------------------------------------------------------------------------

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

  -- Bonus dari family_settings; fallback 2 bila row belum ada.
  select fs.daily_check_in_bonus into v_bonus
  from public.family_settings fs
  where fs.family_id = v_family_id;
  if v_bonus is null then
    v_bonus := 2;
  end if;
  if v_bonus not in (1, 2, 3, 5, 10) then
    v_bonus := 2;
  end if;

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

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (p_profile_id, v_user, v_bonus, 'bonus_checkin', null)
  returning id into v_ledger_id;

  insert into public.daily_check_ins (profile_id, check_in_date, bonus_awarded, ledger_id)
  values (p_profile_id, v_today, v_bonus, v_ledger_id)
  on conflict (profile_id, check_in_date) do nothing
  returning id into v_check_id;

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
  'Bonus harian (Fase 9.1) idempotent per (profil, tanggal kalender keluarga); nilai dari family_settings.daily_check_in_bonus (default 2).';
