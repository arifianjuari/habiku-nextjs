-- Hapus target memicu ON DELETE SET NULL pada incidental_rewards.goal_id.
-- Baris reward dengan hp_to_target > 0 melanggar check (hp_to_target = 0 or goal_id is not null).
-- Sebelum hapus goal, lepaskan ikatan reward insidental sambil mempertahankan jejak audit.

create or replace function public._detach_incidental_rewards_before_goal_delete ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.incidental_rewards
  set
    energy_only = case
      when energy_only > 0 then energy_only
      else hp_to_target
    end,
    hp_to_target = 0
  where goal_id = OLD.id
    and hp_to_target > 0;

  return OLD;
end;
$$;

drop trigger if exists goals_detach_incidental_rewards_before_delete on public.goals;

create trigger goals_detach_incidental_rewards_before_delete
  before delete on public.goals
  for each row
  execute function public._detach_incidental_rewards_before_goal_delete ();

comment on function public._detach_incidental_rewards_before_goal_delete () is
  'Sebelum goals dihapus: nolkan hp_to_target pada incidental_rewards terkait agar FK SET NULL aman.';
