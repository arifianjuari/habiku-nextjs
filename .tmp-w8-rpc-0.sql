-- ---------------------------------------------------------------------------
-- Patch goal HP allocators → ready_to_claim
-- ---------------------------------------------------------------------------

create or replace function public.approve_task_history (p_task_history_id uuid, p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  th public.task_history%rowtype;
  t public.tasks%rowtype;
  v_family_id uuid;
  v_tz text;
  v_today date;
  v_ledger_id uuid;
  v_base_amount int;
  v_amount int;
  v_multiplier numeric;
  v_is_featured boolean;
  v_featured_id uuid;
  v_hp_prev int;
  v_hp_add int;
  v_hp_new int;
  v_remaining int;
  g record;
  g_chosen public.goals%rowtype;
  s public.streaks%rowtype;
  v_streak int;
  v_best int;
  v_new_last date;
  v_has_active boolean;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into th from public.task_history where id = p_task_history_id for update;
  if not found then raise exception 'task_history_not_found'; end if;
  if th.status is distinct from 'pending' then raise exception 'not_pending' using errcode = 'P0001'; end if;

  select * into t from public.tasks where id = th.task_id;
  if not found or t.profile_id is distinct from th.profile_id then raise exception 'task_mismatch'; end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = th.profile_id;
  if v_family_id is null then raise exception 'profile_not_found'; end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_tz := (select f.timezone from public.families f where f.id = v_family_id);
  v_today := (timezone(coalesce(v_tz, 'UTC'), now()))::date;

  select task_id into v_featured_id from public.compute_featured_task(th.profile_id, v_today);
  v_is_featured := (v_featured_id is not null and v_featured_id = t.id);
  v_base_amount := t.reward_points;

  if v_is_featured then
    v_multiplier := public._featured_multiplier_value(v_family_id);
    if v_multiplier is null or v_multiplier <= 0 then v_multiplier := 1.0; end if;
    v_amount := floor(v_base_amount::numeric * v_multiplier)::int;
  else
    v_amount := v_base_amount;
  end if;

  select exists (
    select 1 from public.goals where profile_id = th.profile_id and status = 'active'
  ) into v_has_active;

  if p_goal_id is null then
    if v_has_active then raise exception 'goal_required' using errcode = 'P0001'; end if;
  else
    select * into g_chosen from public.goals
    where id = p_goal_id and profile_id = th.profile_id and status = 'active'
    for update;
    if not found then raise exception 'invalid_goal' using errcode = 'P0001'; end if;
  end if;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (th.profile_id, v_user, v_amount, 'earn', p_task_history_id)
  returning id into v_ledger_id;

  v_remaining := v_amount;

  if p_goal_id is not null then
    v_hp_prev := g_chosen.current_hp;
    v_hp_add := least(v_remaining, g_chosen.target_hp - v_hp_prev);
    if v_hp_add < 0 then v_hp_add := 0; end if;
    if v_hp_add > 0 then
      insert into public.goal_progress_events (profile_id, goal_id, ledger_id, amount)
      values (th.profile_id, g_chosen.id, v_ledger_id, v_hp_add);
      v_hp_new := v_hp_prev + v_hp_add;
      update public.goals
      set
        current_hp = v_hp_new,
        status = public.resolve_goal_status_on_hp_reached(g_chosen.status, v_hp_new, g_chosen.target_hp, v_family_id),
        updated_at = now()
      where id = g_chosen.id;
      v_remaining := v_remaining - v_hp_add;
    end if;
  end if;

  for g in
    select * from public.goals
    where profile_id = th.profile_id
      and status = 'active'
      and (p_goal_id is null or id is distinct from p_goal_id)
    order by created_at asc
  loop
    exit when v_remaining <= 0;
    v_hp_prev := g.current_hp;
    v_hp_add := least(v_remaining, g.target_hp - v_hp_prev);
    if v_hp_add < 0 then v_hp_add := 0; end if;
    if v_hp_add > 0 then
      insert into public.goal_progress_events (profile_id, goal_id, ledger_id, amount)
      values (th.profile_id, g.id, v_ledger_id, v_hp_add);
      v_hp_new := v_hp_prev + v_hp_add;
      update public.goals
      set
        current_hp = v_hp_new,
        status = public.resolve_goal_status_on_hp_reached(g.status::public.goal_status, v_hp_new, g.target_hp, v_family_id),
        updated_at = now()
      where id = g.id;
      v_remaining := v_remaining - v_hp_add;
    end if;
  end loop;

  select * into s from public.streaks
  where profile_id = th.profile_id and task_category = t.category
  for update;

  if not found then
    insert into public.streaks (profile_id, task_category, current_streak, best_streak, last_completed_date, updated_at)
    values (th.profile_id, t.category, 1, 1, v_today, now());
  else
    if s.last_completed_date is null then v_streak := 1;
    elsif s.last_completed_date = v_today then v_streak := s.current_streak;
    elsif s.last_completed_date = v_today - 1 then v_streak := s.current_streak + 1;
    else v_streak := 1;
    end if;
    v_best := greatest(s.best_streak, v_streak);
    v_new_last := v_today;
    update public.streaks
    set current_streak = v_streak, best_streak = v_best, last_completed_date = v_new_last, updated_at = now()
    where id = s.id;
  end if;

  update public.task_history
  set status = 'approved', approved_by_account_id = v_user, approved_at = now()
  where id = p_task_history_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    th.profile_id, 'profile', 'task_approved',
    case
      when v_is_featured then
        'Misi sorotan disetujui. +' || v_amount::text || ' poin (sorotan x'
          || trim(trailing '.0' from v_multiplier::text) || ').'
      else 'Misi selesai disetujui. +' || v_amount::text || ' poin.'
    end
  );
end;
$$;

-- give_incidental_reward HP branch (read full function from latest migration and patch status line)
-- transfer_goal_hp destination branch patch

create or replace function public.transfer_goal_hp (
  p_profile_id uuid,
  p_from_goal_id uuid,
  p_to_goal_id uuid,
  p_amount int,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_from public.goals%rowtype;
  v_to public.goals%rowtype;
  v_amount int;
  v_room int;
  v_to_new int;
  v_note text;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  v_amount := greatest(0, coalesce(p_amount, 0));
  if v_amount < 1 then raise exception 'amount_required' using errcode = 'P0001'; end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = p_profile_id;
  if v_family_id is null then raise exception 'profile_not_found'; end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  if p_from_goal_id = p_to_goal_id then
    raise exception 'same_goal' using errcode = 'P0001';
  end if;

  select * into v_from from public.goals
  where id = p_from_goal_id and profile_id = p_profile_id and status = 'active'
  for update;
  if not found then raise exception 'invalid_from_goal' using errcode = 'P0001'; end if;

  select * into v_to from public.goals
  where id = p_to_goal_id and profile_id = p_profile_id and status = 'active'
  for update;
  if not found then raise exception 'invalid_to_goal' using errcode = 'P0001'; end if;

  if v_from.current_hp < v_amount then
    raise exception 'insufficient_hp' using errcode = 'P0001';
  end if;

  v_room := greatest(0, v_to.target_hp - v_to.current_hp);
  if v_amount > v_room then
    raise exception 'destination_full' using errcode = 'P0001';
  end if;

  update public.goals
  set current_hp = current_hp - v_amount, updated_at = now()
  where id = v_from.id;

  v_to_new := v_to.current_hp + v_amount;
  update public.goals
  set
    current_hp = v_to_new,
    status = public.resolve_goal_status_on_hp_reached(v_to.status, v_to_new, v_to.target_hp, v_family_id),
    updated_at = now()
  where id = v_to.id;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 200 then
    v_note := substring(v_note from 1 for 200);
  end if;

  insert into public.goal_hp_transfers (
    profile_id, from_goal_id, to_goal_id, amount, initiated_by_account_id, note
  )
  values (p_profile_id, v_from.id, v_to.id, v_amount, v_user, v_note);
end;
$$;

-- ---------------------------------------------------------------------------