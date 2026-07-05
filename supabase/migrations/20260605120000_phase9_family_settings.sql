-- Habiku Fase 9.A — `family_settings` (PRD §14.4):
-- Pengaturan engagement per keluarga (1:1 dengan `families`). Berperan sebagai
-- prasyarat untuk fitur Fase 9.B/9.C (multiplier, tip harian, sorotan saudara,
-- kebun energi). Di Fase 9.A yang berlaku langsung: `micro_anim_enabled` dan
-- `check_in_reminder_enabled`.
--
-- Aturan PRD §14.3 butir 17:
--  - Default berorientasi pengalaman penuh (true) kecuali `show_sibling_highlight`
--    (default false; opt-in eksplisit) dan `featured_multiplier` (default '2x').
--  - Hanya peran ortu (primary/secondary) yang dapat membaca/menulis row ini.

create table public.family_settings (
  family_id uuid primary key references public.families (id) on delete cascade,
  micro_anim_enabled boolean not null default true,
  featured_multiplier text not null default '2x'
    check (featured_multiplier in ('1.5x', '2x', '3x')),
  daily_tip_enabled boolean not null default true,
  show_sibling_highlight boolean not null default false,
  check_in_reminder_enabled boolean not null default true,
  family_garden_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.accounts (id) on delete set null
);

comment on table public.family_settings is
  'Pengaturan engagement per keluarga (Fase 9, PRD §14.4); 1:1 dengan families.';
comment on column public.family_settings.featured_multiplier is
  'Multiplier energi misi sorotan harian (Fase 9.4); 1.5x | 2x | 3x.';
comment on column public.family_settings.show_sibling_highlight is
  'Opt-in eksplisit (default false) untuk strip motivasi lintas-anak (Fase 9.8).';

-- Backfill row default untuk seluruh keluarga yang sudah ada.
insert into public.family_settings (family_id)
select id from public.families
on conflict (family_id) do nothing;

-- Trigger auto-create saat `families` baru dibuat (mis. via bootstrap_primary_family).
create or replace function public.ensure_family_settings_row ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_settings (family_id)
  values (new.id)
  on conflict (family_id) do nothing;
  return new;
end;
$$;

drop trigger if exists families_ensure_family_settings on public.families;
create trigger families_ensure_family_settings
  after insert on public.families
  for each row
  execute function public.ensure_family_settings_row ();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.family_settings enable row level security;

-- SELECT: anggota keluarga (ortu primary/secondary) yang sama.
create policy family_settings_select_parent on public.family_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = auth.uid()
        and a.family_id = family_settings.family_id
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

-- UPDATE: hanya ortu di keluarga yang sama.
create policy family_settings_update_parent on public.family_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.accounts a
      where a.id = auth.uid()
        and a.family_id = family_settings.family_id
        and a.role in ('primary_parent', 'secondary_parent')
    )
  )
  with check (
    exists (
      select 1
      from public.accounts a
      where a.id = auth.uid()
        and a.family_id = family_settings.family_id
        and a.role in ('primary_parent', 'secondary_parent')
    )
  );

-- INSERT/DELETE tidak diizinkan langsung (row dikelola trigger di atas).
revoke insert, delete on public.family_settings from public;

-- Trigger BEFORE UPDATE untuk maintain `updated_at`.
create or replace function public.touch_family_settings_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists family_settings_touch_updated on public.family_settings;
create trigger family_settings_touch_updated
  before update on public.family_settings
  for each row
  execute function public.touch_family_settings_updated_at ();
