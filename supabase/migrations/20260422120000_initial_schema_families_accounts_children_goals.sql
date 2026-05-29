-- Habiku — Fase 1.1–1.5: families, accounts, child_profiles, goals + RLS + bootstrap Primary Parent
-- Skema mengacu docs/prd-habiku-react.md & docs/implementation-roadmap-react.md

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.account_role as enum ('primary_parent', 'secondary_parent');

create type public.goal_status as enum ('active', 'completed', 'archived');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Keluarga',
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now()
);

comment on table public.families is 'Satu entitas keluarga; semua anggota (ortu) terikat lewat accounts.';

-- Akun orang tua: 1:1 dengan auth.users
create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  role public.account_role not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_family_id_idx on public.accounts (family_id);

comment on table public.accounts is 'Ortu (primary/secondary); id = supabase auth user id.';

create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  pin_hash text not null,
  avatar_url text,
  attr_discipline int not null default 0,
  attr_responsibility int not null default 0,
  attr_independence int not null default 0,
  attr_care int not null default 0,
  attr_honesty int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index child_profiles_family_id_idx on public.child_profiles (family_id);

comment on table public.child_profiles is 'Profil anak; pin_hash = hash kunci (opaque), bukan PIN plaintext.';

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  title text not null,
  image_url text,
  target_hp int not null check (target_hp > 0),
  current_hp int not null default 0 check (current_hp >= 0),
  status public.goal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_profile_id_idx on public.goals (profile_id);

comment on table public.goals is 'Satu profil: maks. satu status active (partial unique).';

-- Single Active Goal (MVP)
create unique index goals_one_active_per_child
  on public.goals (profile_id)
  where (status = 'active');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.families enable row level security;
alter table public.accounts enable row level security;
alter table public.child_profiles enable row level security;
alter table public.goals enable row level security;

-- families: baca/ubah hanya anggota keluarga yang sama
create policy "families_select_member"
  on public.families
  for select
  to authenticated
  using (
    id in (select a.family_id from public.accounts a where a.id = (select auth.uid()))
  );

create policy "families_update_parent"
  on public.families
  for update
  to authenticated
  using (
    id in (
      select a.family_id
      from public.accounts a
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  )
  with check (
    id in (
      select a.family_id
      from public.accounts a
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

-- accounts: baca anggota keluarga sendiri; update hanya baris diri
create policy "accounts_select_family"
  on public.accounts
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or family_id in (select a.family_id from public.accounts a where a.id = (select auth.uid()))
  );

create policy "accounts_update_self"
  on public.accounts
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and family_id in (
    select a.family_id from public.accounts a where a.id = (select auth.uid())
  ));

-- child_profiles: CRUD hanya jika user adalah ortu di keluarga yang sama
create policy "child_profiles_select_family"
  on public.child_profiles
  for select
  to authenticated
  using (
    family_id in (select a.family_id from public.accounts a where a.id = (select auth.uid()))
  );

create policy "child_profiles_insert_parent"
  on public.child_profiles
  for insert
  to authenticated
  with check (
    family_id in (
      select a.family_id
      from public.accounts a
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

create policy "child_profiles_update_parent"
  on public.child_profiles
  for update
  to authenticated
  using (
    family_id in (
      select a.family_id
      from public.accounts a
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  )
  with check (
    family_id in (
      select a.family_id
      from public.accounts a
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

create policy "child_profiles_delete_parent"
  on public.child_profiles
  for delete
  to authenticated
  using (
    family_id in (
      select a.family_id
      from public.accounts a
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

-- goals: ortu baca/ubah target milik anak di keluarga; perhalus SELECT vs mutasi
create policy "goals_select_family"
  on public.goals
  for select
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
    )
  );

create policy "goals_insert_parent"
  on public.goals
  for insert
  to authenticated
  with check (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

create policy "goals_update_parent"
  on public.goals
  for update
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  )
  with check (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

create policy "goals_delete_parent"
  on public.goals
  for delete
  to authenticated
  using (
    profile_id in (
      select c.id
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where a.id = (select auth.uid())
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

-- ---------------------------------------------------------------------------
-- Alur Primary Parent: bootstrap pasca-signup
-- ---------------------------------------------------------------------------

create or replace function public.bootstrap_primary_family (p_family_name text default 'Keluarga')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_user uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from public.accounts where id = v_user) then
    raise exception 'Account already has a family';
  end if;
  insert into public.families (name) values (coalesce(nullif(trim(p_family_name), ''), 'Keluarga'))
  returning id into v_family_id;
  insert into public.accounts (id, family_id, role)
  values (v_user, v_family_id, 'primary_parent');
  return v_family_id;
end;
$$;

revoke all on function public.bootstrap_primary_family (text) from public;
grant execute on function public.bootstrap_primary_family (text) to authenticated;

comment on function public.bootstrap_primary_family (text) is
  'Panggil sekali pasca-signup: buat families + account primary_parent.';

-- ---------------------------------------------------------------------------
-- Grants (suplemen default Supabase; eksplisit untuk tabel baru)
-- ---------------------------------------------------------------------------

grant select, update on public.families to authenticated;
grant select, update on public.accounts to authenticated;
grant select, insert, update, delete on public.child_profiles to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
