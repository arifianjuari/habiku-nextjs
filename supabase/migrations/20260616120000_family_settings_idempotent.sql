-- Perbaikan idempotent untuk `family_settings` (Fase 9.A).
-- Aman dijalankan di SQL Editor / `supabase db push` meskipun migrasi
-- 20260613120000_phase9_family_settings.sql sudah pernah dijalankan sebagian
-- atau tabel sudah ada (ERROR 42P07: relation already exists).
--
-- Yang dilakukan:
--   1. Buat tabel minimal jika belum ada; tambah kolom yang belum ada.
--   2. Pastikan CHECK `featured_multiplier` (tanpa menghapus data valid).
--   3. Normalisasi nilai multiplier ilegal → '2x'.
--   4. Backfill baris per keluarga, fungsi trigger, RLS, revoke, touch `updated_at`.

-- ---------------------------------------------------------------------------
-- 1. Tabel + kolom (idempotent)
-- ---------------------------------------------------------------------------

create table if not exists public.family_settings (
  family_id uuid primary key references public.families (id) on delete cascade
);

alter table public.family_settings
  add column if not exists micro_anim_enabled boolean not null default true;

alter table public.family_settings
  add column if not exists featured_multiplier text not null default '2x';

alter table public.family_settings
  add column if not exists daily_tip_enabled boolean not null default true;

alter table public.family_settings
  add column if not exists show_sibling_highlight boolean not null default false;

alter table public.family_settings
  add column if not exists check_in_reminder_enabled boolean not null default true;

alter table public.family_settings
  add column if not exists family_garden_enabled boolean not null default true;

alter table public.family_settings
  add column if not exists updated_at timestamptz not null default now();

alter table public.family_settings
  add column if not exists updated_by uuid references public.accounts (id) on delete set null;

-- Data lama / nilai tak terduga → patuhi domain 1.5x | 2x | 3x sebelum CHECK.
update public.family_settings
set featured_multiplier = '2x'
where featured_multiplier is null
   or trim(featured_multiplier) not in ('1.5x', '2x', '3x');

-- CHECK nama stabil (hindari duplikat).
alter table public.family_settings
  drop constraint if exists family_settings_featured_multiplier_check;

alter table public.family_settings
  add constraint family_settings_featured_multiplier_check
    check (featured_multiplier in ('1.5x', '2x', '3x'));

comment on table public.family_settings is
  'Pengaturan engagement per keluarga (Fase 9, PRD §14.4); 1:1 dengan families.';
comment on column public.family_settings.featured_multiplier is
  'Multiplier energi misi sorotan harian (Fase 9.4); 1.5x | 2x | 3x.';
comment on column public.family_settings.show_sibling_highlight is
  'Opt-in eksplisit (default false) untuk strip motivasi lintas-anak (Fase 9.8).';

-- ---------------------------------------------------------------------------
-- 2. Backfill & trigger insert pada `families`
-- ---------------------------------------------------------------------------

insert into public.family_settings (family_id)
select id from public.families
on conflict (family_id) do nothing;

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
-- 3. RLS (drop + buat ulang agar selaras)
-- ---------------------------------------------------------------------------

alter table public.family_settings enable row level security;

drop policy if exists family_settings_select_parent on public.family_settings;
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

drop policy if exists family_settings_update_parent on public.family_settings;
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

revoke insert, delete on public.family_settings from public;

-- ---------------------------------------------------------------------------
-- 4. Touch `updated_at` pada UPDATE
-- ---------------------------------------------------------------------------

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
