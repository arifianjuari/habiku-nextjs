-- In-app: ortu dapat baris di `notifications` saat anak mengajukan target (selaras misi pending).

create or replace function public.notify_parents_on_goal_request_pending ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_child_name text;
  v_family_id uuid;
  v_title text;
  r record;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  select c.family_id, c.name
    into v_family_id, v_child_name
  from public.child_profiles c
  where c.id = new.profile_id;

  v_title := left(trim(coalesce(new.title, '')), 200);
  if v_title = '' then
    v_title := 'Target';
  end if;

  for r in
    select a.id as account_id
    from public.accounts a
    where a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  loop
    insert into public.notifications (recipient_id, recipient_type, type, content)
    values (
      r.account_id,
      'account',
      'goal_request_pending',
      coalesce(v_child_name, 'Anak') || ' mengajukan target: ' || v_title
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_goal_requests_notify_parents on public.goal_requests;

create trigger trg_goal_requests_notify_parents
  after insert on public.goal_requests
  for each row
  execute function public.notify_parents_on_goal_request_pending ();

comment on function public.notify_parents_on_goal_request_pending () is
  'Fase 5: insert notifications (recipient account) saat pengajuan target dari anak (pending).';
