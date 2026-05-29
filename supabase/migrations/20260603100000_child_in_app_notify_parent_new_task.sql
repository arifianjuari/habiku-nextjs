-- In-app ke profil anak saat ortu menambah misi aktif atau mengaktifkan misi yang nonaktif.

create or replace function public.notify_child_profile_on_task_insert ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if new.is_active is distinct from true then
    return new;
  end if;

  v_title := left(trim(both from coalesce(new.title, '')), 120);
  if v_title = '' then
    v_title := 'Misi';
  end if;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    new.profile_id,
    'profile',
    'task_assigned',
    'Ada misi baru: «' || v_title || '». Buka tab Misi untuk mulai.'
  );

  return new;
end;
$$;

create or replace function public.notify_child_profile_on_task_activated ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if old.is_active is true then
    return new;
  end if;
  if new.is_active is not true then
    return new;
  end if;

  v_title := left(trim(both from coalesce(new.title, '')), 120);
  if v_title = '' then
    v_title := 'Misi';
  end if;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    new.profile_id,
    'profile',
    'task_assigned',
    'Misi «' || v_title || '» sekarang aktif. Buka tab Misi ya.'
  );

  return new;
end;
$$;

drop trigger if exists trg_tasks_notify_child_on_insert on public.tasks;

create trigger trg_tasks_notify_child_on_insert
  after insert on public.tasks
  for each row
  execute function public.notify_child_profile_on_task_insert ();

drop trigger if exists trg_tasks_notify_child_on_activate on public.tasks;

create trigger trg_tasks_notify_child_on_activate
  after update of is_active on public.tasks
  for each row
  execute function public.notify_child_profile_on_task_activated ();

comment on function public.notify_child_profile_on_task_insert () is
  'Setelah ortu insert tasks aktif: notifikasi in-app ke recipient_type profile (anak).';

comment on function public.notify_child_profile_on_task_activated () is
  'Setelah misi diaktifkan (is_active false→true): notifikasi in-app ke profil anak.';
