-- Patch give_incidental_reward → ready_to_claim
create or replace function public.give_incidental_reward (
  p_profile_id uuid,
  p_title text,
  p_note text,
  p_category public.task_category,
  p_hp_to_target int,
  p_energy_only int,
  p_goal_id uuid
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
  v_hp int;
  v_energy int;
  v_goal public.goals%rowtype;
  v_hp_room int;
  v_hp_add int;
  v_hp_new int;
  v_hp_ledger_id uuid;
  v_energy_ledger_id uuid;
  v_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'not_authenticated'; end if;

  v_title := trim(coalesce(p_title, ''));
  if char_length(v_title) = 0 then raise exception 'title_required' using errcode = 'P0001'; end if;
  if char_length(v_title) > 80 then v_title := substring(v_title from 1 for 80); end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 200 then
    v_note := substring(v_note from 1 for 200);
  end if;

  v_hp := greatest(0, coalesce(p_hp_to_target, 0));
  v_energy := greatest(0, coalesce(p_energy_only, 0));
  if v_hp = 0 and v_energy = 0 then raise exception 'amount_required' using errcode = 'P0001'; end if;

  select c.family_id into v_family_id from public.child_profiles c where c.id = p_profile_id;
  if v_family_id is null then raise exception 'profile_not_found'; end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_hp > 0 then
    if p_goal_id is null then raise exception 'goal_required' using errcode = 'P0001'; end if;
    select * into v_goal from public.goals
    where id = p_goal_id and profile_id = p_profile_id and status = 'active'
    for update;
    if not found then raise exception 'invalid_goal' using errcode = 'P0001'; end if;

    v_hp_room := greatest(0, v_goal.target_hp - v_goal.current_hp);
    v_hp_add := least(v_hp, v_hp_room);
    if v_hp_add > 0 then
      insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
      values (p_profile_id, v_user, v_hp_add, 'earn', null)
      returning id into v_hp_ledger_id;

      insert into public.goal_progress_events (profile_id, goal_id, ledger_id, amount)
      values (p_profile_id, v_goal.id, v_hp_ledger_id, v_hp_add);

      v_hp_new := v_goal.current_hp + v_hp_add;
      update public.goals
      set
        current_hp = v_hp_new,
        status = public.resolve_goal_status_on_hp_reached(v_goal.status, v_hp_new, v_goal.target_hp, v_family_id),
        updated_at = now()
      where id = v_goal.id;
    end if;
  end if;

  if v_energy > 0 then
    insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
    values (p_profile_id, v_user, v_energy, 'earn', null)
    returning id into v_energy_ledger_id;
  end if;

  insert into public.incidental_rewards (
    profile_id, granted_by_account_id, title, note, category,
    hp_to_target, energy_only, goal_id, hp_ledger_id, energy_ledger_id
  )
  values (
    p_profile_id, v_user, v_title, v_note, coalesce(p_category, 'lainnya'),
    v_hp, v_energy,
    case when v_hp > 0 then v_goal.id else null end,
    v_hp_ledger_id, v_energy_ledger_id
  )
  returning id into v_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    p_profile_id, 'profile', 'incidental_reward',
    'Energi insidental: ' || v_title ||
      case when v_hp > 0 then ' · +' || v_hp::text || ' HP target' else '' end ||
      case when v_energy > 0 then ' · +' || v_energy::text || ' energi' else '' end
  );

  return v_id;
end;
$$;