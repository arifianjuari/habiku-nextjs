-- Habiku Fase 9.1 — Daily check-in chain (PRD §14.2 / §14.3 butir 11):
-- Anak yang membuka aplikasi mendapat bonus energi kecil idempotent per hari.
-- Bonus dicatat sebagai `point_ledger.type = 'bonus_checkin'` agar terpisah dari
-- `earn` yang berasal dari approval misi.
--
-- Tabel `daily_check_ins` menjadi sumber kebenaran "sudah klaim hari ini" via
-- UNIQUE (profile_id, check_in_date). RPC pemberian bonus tinggal di migrasi
-- berikutnya supaya nilai enum baru sudah commit lebih dulu.

-- Tambah nilai enum 'bonus_checkin' ke ledger_type. ALTER TYPE ... ADD VALUE
-- harus berada di luar transaksi yang menggunakan nilai itu, jadi pisahkan
-- migrasi RPC ke file lain.
alter type public.ledger_type add value if not exists 'bonus_checkin';

-- ---------------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------------

create table public.daily_check_ins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  check_in_date date not null,
  bonus_awarded int not null default 2 check (bonus_awarded > 0 and bonus_awarded <= 10),
  ledger_id uuid references public.point_ledger (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (profile_id, check_in_date)
);

create index daily_check_ins_profile_date_idx
  on public.daily_check_ins (profile_id, check_in_date desc);

comment on table public.daily_check_ins is
  'Bonus harian "buka app" anak (Fase 9.1); idempotent via UNIQUE(profile_id, check_in_date).';
comment on column public.daily_check_ins.check_in_date is
  'Tanggal kalender pada timezone keluarga saat bonus diberikan.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.daily_check_ins enable row level security;

-- SELECT: anggota keluarga (ortu maupun anak yang punya akses ke profil).
-- Sama dengan pola di `incidental_rewards`: cek family_id via child_profiles join accounts.
create policy daily_check_ins_select_family on public.daily_check_ins
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = daily_check_ins.profile_id
        and a.id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE hanya melalui RPC `security definer`.
revoke insert, update, delete on public.daily_check_ins from public;
