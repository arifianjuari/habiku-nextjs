-- Plafon bunga kantong: gunakan batas kolom DB (2000 bps = 20%), bukan default keluarga 5%.

create or replace function public.create_savings_pocket_v2 (
  p_profile_id uuid,
  p_name text,
  p_pocket_type public.savings_pocket_type default 'flexible',
  p_emoji text default '🐷',
  p_accent_color text default '#8B5CF6',
  p_target_amount int default null,
  p_monthly_interest_bps int default 0,
  p_lock_months int default null,
  p_lock_bonus_coefficient numeric default 1.0,
  p_default_for_goal_save boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_name text;
  v_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  v_name := trim(coalesce(p_name, ''));
  if char_length(v_name) = 0 then raise exception 'name_required' using errcode = 'P0001'; end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = p_profile_id;
  if v_family_id is null then raise exception 'profile_not_found'; end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  if not coalesce((select fs.savings_enabled from public.family_settings fs where fs.family_id = v_family_id), true) then
    raise exception 'savings_disabled' using errcode = 'P0001';
  end if;

  if coalesce(p_monthly_interest_bps, 0) > 2000 then
    raise exception 'interest_rate_too_high' using errcode = 'P0001';
  end if;

  if p_pocket_type = 'term' and (p_lock_months is null or p_lock_months < 1) then
    raise exception 'lock_months_required' using errcode = 'P0001';
  end if;

  if p_default_for_goal_save then
    update public.savings_pockets
    set default_for_goal_save = false
    where profile_id = p_profile_id and default_for_goal_save = true;
  end if;

  insert into public.savings_pockets (
    profile_id, name, emoji, accent_color, target_amount, created_by_account_id,
    pocket_type, monthly_interest_bps, lock_months, lock_bonus_coefficient, default_for_goal_save
  )
  values (
    p_profile_id,
    substring(v_name from 1 for 40),
    coalesce(nullif(trim(p_emoji), ''), '🐷'),
    coalesce(nullif(trim(p_accent_color), ''), '#8B5CF6'),
    case when p_target_amount is not null and p_target_amount > 0 then p_target_amount else null end,
    v_user,
    coalesce(p_pocket_type, 'flexible'),
    greatest(0, coalesce(p_monthly_interest_bps, 0)),
    case when p_pocket_type = 'term' then p_lock_months else null end,
    greatest(0.1, least(5.0, coalesce(p_lock_bonus_coefficient, 1.0))),
    coalesce(p_default_for_goal_save, false)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_savings_pocket_v2 (
  p_pocket_id uuid,
  p_name text,
  p_emoji text default '🐷',
  p_accent_color text default '#8B5CF6',
  p_target_amount int default null,
  p_pocket_type public.savings_pocket_type default 'flexible',
  p_monthly_interest_bps int default 0,
  p_lock_months int default null,
  p_lock_bonus_coefficient numeric default 1.0,
  p_default_for_goal_save boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_pocket public.savings_pockets%rowtype;
  v_name text;
  v_balance int;
  v_new_type public.savings_pocket_type;
  v_new_bps int;
  v_new_lock_months int;
  v_new_lock_coef numeric;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_pocket from public.savings_pockets where id = p_pocket_id and is_active;
  if not found then raise exception 'pocket_not_found' using errcode = 'P0001'; end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = v_pocket.profile_id;
  if v_family_id is null then raise exception 'profile_not_found'; end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  if not coalesce((select fs.savings_enabled from public.family_settings fs where fs.family_id = v_family_id), true) then
    raise exception 'savings_disabled' using errcode = 'P0001';
  end if;

  v_name := trim(coalesce(p_name, ''));
  if char_length(v_name) = 0 then raise exception 'name_required' using errcode = 'P0001'; end if;

  v_balance := public.compute_savings_pocket_balance(p_pocket_id);

  if v_balance = 0 then
    v_new_type := coalesce(p_pocket_type, v_pocket.pocket_type);
    v_new_bps := greatest(0, coalesce(p_monthly_interest_bps, 0));
    if v_new_bps > 2000 then
      raise exception 'interest_rate_too_high' using errcode = 'P0001';
    end if;
    if v_new_type = 'term' and (p_lock_months is null or p_lock_months < 1) then
      raise exception 'lock_months_required' using errcode = 'P0001';
    end if;
    v_new_lock_months := case when v_new_type = 'term' then p_lock_months else null end;
    v_new_lock_coef := greatest(0.1, least(5.0, coalesce(p_lock_bonus_coefficient, 1.0)));
  else
    v_new_type := v_pocket.pocket_type;
    v_new_bps := v_pocket.monthly_interest_bps;
    v_new_lock_months := v_pocket.lock_months;
    v_new_lock_coef := v_pocket.lock_bonus_coefficient;
  end if;

  if coalesce(p_default_for_goal_save, false) then
    update public.savings_pockets
    set default_for_goal_save = false
    where profile_id = v_pocket.profile_id
      and default_for_goal_save = true
      and id <> p_pocket_id;
  end if;

  update public.savings_pockets
  set
    name = substring(v_name from 1 for 40),
    emoji = coalesce(nullif(trim(p_emoji), ''), '🐷'),
    accent_color = coalesce(nullif(trim(p_accent_color), ''), '#8B5CF6'),
    target_amount = case when p_target_amount is not null and p_target_amount > 0 then p_target_amount else null end,
    pocket_type = v_new_type,
    monthly_interest_bps = v_new_bps,
    lock_months = v_new_lock_months,
    lock_bonus_coefficient = v_new_lock_coef,
    default_for_goal_save = coalesce(p_default_for_goal_save, false)
  where id = p_pocket_id;
end;
$$;

revoke all on function public.create_savings_pocket_v2 (
  uuid, text, public.savings_pocket_type, text, text, int, int, int, numeric, boolean
) from public;
grant execute on function public.create_savings_pocket_v2 (
  uuid, text, public.savings_pocket_type, text, text, int, int, int, numeric, boolean
) to authenticated;

revoke all on function public.update_savings_pocket_v2 (
  uuid, text, text, text, int, public.savings_pocket_type, int, int, numeric, boolean
) from public;
grant execute on function public.update_savings_pocket_v2 (
  uuid, text, text, text, int, public.savings_pocket_type, int, int, numeric, boolean
) to authenticated;
