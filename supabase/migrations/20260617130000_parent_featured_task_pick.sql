-- Misi sorotan: pilihan ortu per anak (`child_profiles.featured_task_id`), bukan hash acak.
-- - `set_child_featured_task`: ortu menetapkan / menghapus sorotan (hanya misi aktif milik anak itu).
-- - `compute_featured_task`: mengembalikan misi yang disematkan jika masih aktif; kalau tidak ada, tidak ada baris.
-- - Trigger: nonaktifkan misi → semat sorotan dihapus otomatis.
-- Backfill: untuk tiap anak, isi dengan sorotan deterministik lama (md5 + hari ini TZ keluarga) agar perilaku tetap sampai ortu mengubah.

alter table public.child_profiles
  add column if not exists featured_task_id uuid references public.tasks (id) on delete set null;

comment on column public.child_profiles.featured_task_id is
  'Misi sorotan berganda (multiplier): dipilih ortu; harus misi aktif milik anak ini.';

create index if not exists child_profiles_featured_task_id_idx
  on public.child_profiles (featured_task_id)
  where featured_task_id is not null;

-- Backfill dari logika lama (satu kali, agar tidak hilang bonus sorotan mendadak).
update public.child_profiles c
set featured_task_id = x.task_id
from (
  select
    c2.id as profile_id,
    (
      select t.id
      from public.tasks t
      where t.profile_id = c2.id
        and t.is_active = true
      order by md5(
        t.id::text || (
          timezone(
            coalesce(
              (select f.timezone from public.families f where f.id = c2.family_id limit 1),
              'UTC'
            ),
            now()
          )
        )::date::text
      )
      limit 1
    ) as task_id
  from public.child_profiles c2
) x
where c.id = x.profile_id
  and c.featured_task_id is null
  and x.task_id is not null;

-- Ortu: set / clear sorotan.
create or replace function public.set_child_featured_task (
  p_profile_id uuid,
  p_task_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if public.current_account_role() is distinct from 'primary_parent'
     and public.current_account_role() is distinct from 'secondary_parent' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.child_profiles c
    where c.id = p_profile_id
      and c.family_id = public.current_family_id()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_task_id is null then
    update public.child_profiles
    set featured_task_id = null, updated_at = now()
    where id = p_profile_id;
    return;
  end if;

  if not exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and t.profile_id = p_profile_id
      and t.is_active = true
  ) then
    raise exception 'invalid_featured_task' using errcode = 'P0001';
  end if;

  update public.child_profiles
  set featured_task_id = p_task_id, updated_at = now()
  where id = p_profile_id;
end;
$fn$;

revoke all on function public.set_child_featured_task (uuid, uuid) from public;
grant execute on function public.set_child_featured_task (uuid, uuid) to authenticated;

comment on function public.set_child_featured_task (uuid, uuid) is
  'Ortu: tetapkan misi sorotan (berganda) untuk satu anak, atau null untuk menghapus.';

-- Saat misi dinonaktifkan, lepas sorotan bila mengacu ke misi itu.
create or replace function public.clear_featured_task_on_task_deactivate ()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.is_active is false and old.is_active is true then
    update public.child_profiles
    set featured_task_id = null, updated_at = now()
    where featured_task_id = new.id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists tasks_clear_featured_on_deactivate on public.tasks;
create trigger tasks_clear_featured_on_deactivate
  after update of is_active on public.tasks
  for each row
  execute function public.clear_featured_task_on_task_deactivate ();

-- Sorotan = misi yang disemat ortu (masih aktif). Parameter p_day tetap ada untuk signature; tidak dipakai lagi.
create or replace function public.compute_featured_task (
  p_profile_id uuid,
  p_day date default null
)
returns table (
  task_id uuid,
  multiplier_text text,
  multiplier_value numeric
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_family_id uuid;
  v_caller_family uuid;
  v_caller_account uuid;
  v_pinned uuid;
begin
  if p_profile_id is null then
    raise exception 'p_profile_id wajib diisi.';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = p_profile_id;
  if v_family_id is null then
    raise exception 'Profil anak tidak ditemukan.';
  end if;

  select a.id, a.family_id into v_caller_account, v_caller_family
  from public.accounts a
  where a.id = auth.uid();

  if v_caller_account is null then
    if not exists (
      select 1 from public.child_profiles c2
      where c2.id = auth.uid() and c2.family_id = v_family_id
    ) then
      raise exception 'Tidak diizinkan: caller bukan anggota keluarga.';
    end if;
  elsif v_caller_family is distinct from v_family_id then
    raise exception 'Tidak diizinkan: lintas keluarga.';
  end if;

  select c.featured_task_id into v_pinned
  from public.child_profiles c
  where c.id = p_profile_id;

  if v_pinned is null then
    return;
  end if;

  if not exists (
    select 1
    from public.tasks t
    where t.id = v_pinned
      and t.profile_id = p_profile_id
      and t.is_active = true
  ) then
    return;
  end if;

  return query
  select
    v_pinned,
    coalesce(
      (
        select fs.featured_multiplier
        from public.family_settings fs
        where fs.family_id = v_family_id
        limit 1
      ),
      '2x'
    ),
    coalesce(public._featured_multiplier_value(v_family_id), 2.0);
end;
$fn$;

comment on function public.compute_featured_task (uuid, date) is
  'Misi sorotan berganda: pakai child_profiles.featured_task_id jika masih misi aktif; kosong bila tidak diset atau tidak valid.';
