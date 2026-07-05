-- W7 — Tabungan digital (Kantong): kantong per anak, setor/tarik via ledger append-only.

-- ---------------------------------------------------------------------------
-- Enum & settings
-- ---------------------------------------------------------------------------

alter type public.ledger_type add value if not exists 'savings_deposit';
alter type public.ledger_type add value if not exists 'savings_withdraw';

create type public.savings_tx_kind as enum ('deposit', 'withdraw');

create type public.savings_withdraw_status as enum ('pending', 'approved', 'rejected');

alter table public.family_settings
  add column if not exists savings_enabled boolean not null default true;

comment on column public.family_settings.savings_enabled is
  'Nonaktifkan UI tabungan; RPC tetap boleh dipanggil jika diaktifkan kembali.';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.savings_pockets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  emoji text not null default '🐷' check (char_length(emoji) between 1 and 8),
  accent_color text not null default '#8B5CF6' check (char_length(accent_color) <= 32),
  target_amount int check (target_amount is null or target_amount > 0),
  is_active boolean not null default true,
  created_by_account_id uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index savings_pockets_profile_id_idx
  on public.savings_pockets (profile_id, is_active, created_at desc);

comment on table public.savings_pockets is
  'Kantong tabungan digital per anak; saldo = agregat savings_transactions.';

create table public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  pocket_id uuid not null references public.savings_pockets (id) on delete cascade,
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  kind public.savings_tx_kind not null,
  amount int not null check (amount > 0),
  ledger_id uuid references public.point_ledger (id) on delete restrict,
  withdraw_status public.savings_withdraw_status,
  note text check (note is null or char_length(note) <= 200),
  requested_by_account_id uuid references public.accounts (id) on delete set null,
  reviewed_by_account_id uuid references public.accounts (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
  (kind = 'deposit' and withdraw_status is null and ledger_id is not null)
  or (kind = 'withdraw' and withdraw_status is not null)
  )
);

create index savings_transactions_pocket_id_idx
  on public.savings_transactions (pocket_id, created_at desc);
create index savings_transactions_profile_pending_idx
  on public.savings_transactions (profile_id, withdraw_status)
  where kind = 'withdraw' and withdraw_status = 'pending';

comment on table public.savings_transactions is
  'Setor langsung (ledger negatif); tarik pending lalu ledger positif saat disetujui.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.savings_pockets enable row level security;
alter table public.savings_transactions enable row level security;

create policy savings_pockets_select_family on public.savings_pockets
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = savings_pockets.profile_id
        and a.id = auth.uid()
    )
  );

create policy savings_transactions_select_family on public.savings_transactions
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = savings_transactions.profile_id
        and a.id = auth.uid()
    )
  );

revoke insert, update, delete on public.savings_pockets from public;
revoke insert, update, delete on public.savings_transactions from public;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.compute_wallet_balance (p_profile_id uuid)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(amount), 0)::int
  from public.point_ledger
  where profile_id = p_profile_id;
$$;

create or replace function public.compute_savings_pocket_balance (p_pocket_id uuid)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(
    case
      when kind = 'deposit' then amount
      when kind = 'withdraw' and withdraw_status = 'approved' then -amount
      else 0
    end
  ), 0)::int
  from public.savings_transactions
  where pocket_id = p_pocket_id;
$$;

create or replace function public.compute_savings_reserved_balance (p_pocket_id uuid)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(amount), 0)::int
  from public.savings_transactions
  where pocket_id = p_pocket_id
    and kind = 'withdraw'
    and withdraw_status = 'pending';
$$;

-- ---------------------------------------------------------------------------
-- RPC: create_savings_pocket
-- ---------------------------------------------------------------------------

create or replace function public.create_savings_pocket (
  p_profile_id uuid,
  p_name text,
  p_emoji text default '🐷',
  p_accent_color text default '#8B5CF6',
  p_target_amount int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_name text;
  v_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  v_name := trim(coalesce(p_name, ''));
  if char_length(v_name) = 0 then
    raise exception 'name_required' using errcode = 'P0001';
  end if;
  if char_length(v_name) > 40 then
    v_name := substring(v_name from 1 for 40);
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = p_profile_id;
  if v_family_id is null then
    raise exception 'profile_not_found';
  end if;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user
      and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  if not coalesce(
    (select fs.savings_enabled from public.family_settings fs where fs.family_id = v_family_id),
    true
  ) then
    raise exception 'savings_disabled' using errcode = 'P0001';
  end if;

  insert into public.savings_pockets (
    profile_id, name, emoji, accent_color, target_amount, created_by_account_id
  )
  values (
    p_profile_id,
    v_name,
    coalesce(nullif(trim(p_emoji), ''), '🐷'),
    coalesce(nullif(trim(p_accent_color), ''), '#8B5CF6'),
    case when p_target_amount is not null and p_target_amount > 0 then p_target_amount else null end,
    v_user
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_savings_pocket (uuid, text, text, text, int) from public;
grant execute on function public.create_savings_pocket (uuid, text, text, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: deposit_to_savings
-- ---------------------------------------------------------------------------

create or replace function public.deposit_to_savings (
  p_pocket_id uuid,
  p_amount int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_pocket public.savings_pockets%rowtype;
  v_family_id uuid;
  v_amount int;
  v_wallet int;
  v_ledger_id uuid;
  v_tx_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  v_amount := greatest(0, coalesce(p_amount, 0));
  if v_amount < 1 then
    raise exception 'amount_required' using errcode = 'P0001';
  end if;
  if v_amount > 500 then
    v_amount := 500;
  end if;

  select * into v_pocket
  from public.savings_pockets
  where id = p_pocket_id and is_active;
  if not found then
    raise exception 'pocket_not_found';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = v_pocket.profile_id;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user and a.family_id = v_family_id
  ) then
    raise exception 'forbidden';
  end if;

  if not coalesce(
    (select fs.savings_enabled from public.family_settings fs where fs.family_id = v_family_id),
    true
  ) then
    raise exception 'savings_disabled' using errcode = 'P0001';
  end if;

  v_wallet := public.compute_wallet_balance(v_pocket.profile_id);
  if v_wallet < v_amount then
    raise exception 'insufficient_wallet' using errcode = 'P0001';
  end if;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (v_pocket.profile_id, v_user, -v_amount, 'savings_deposit', null)
  returning id into v_ledger_id;

  insert into public.savings_transactions (
    pocket_id, profile_id, kind, amount, ledger_id, requested_by_account_id
  )
  values (
    p_pocket_id, v_pocket.profile_id, 'deposit', v_amount, v_ledger_id, v_user
  )
  returning id into v_tx_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'savings_deposit',
    (select name from public.child_profiles where id = v_pocket.profile_id)
    || ' menabung ' || v_amount::text || ' energi ke kantong «' || v_pocket.name || '».'
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent')
    and a.id <> v_user;

  return v_tx_id;
end;
$$;

revoke all on function public.deposit_to_savings (uuid, int) from public;
grant execute on function public.deposit_to_savings (uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: request_savings_withdraw
-- ---------------------------------------------------------------------------

create or replace function public.request_savings_withdraw (
  p_pocket_id uuid,
  p_amount int,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_pocket public.savings_pockets%rowtype;
  v_family_id uuid;
  v_amount int;
  v_available int;
  v_reserved int;
  v_note text;
  v_tx_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  v_amount := greatest(0, coalesce(p_amount, 0));
  if v_amount < 1 then
    raise exception 'amount_required' using errcode = 'P0001';
  end if;

  select * into v_pocket from public.savings_pockets where id = p_pocket_id and is_active;
  if not found then
    raise exception 'pocket_not_found';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c where c.id = v_pocket.profile_id;

  if not exists (
    select 1 from public.accounts a where a.id = v_user and a.family_id = v_family_id
  ) then
    raise exception 'forbidden';
  end if;

  v_available := public.compute_savings_pocket_balance(p_pocket_id);
  v_reserved := public.compute_savings_reserved_balance(p_pocket_id);
  if v_available - v_reserved < v_amount then
    raise exception 'insufficient_pocket' using errcode = 'P0001';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 200 then
    v_note := substring(v_note from 1 for 200);
  end if;

  insert into public.savings_transactions (
    pocket_id, profile_id, kind, amount, withdraw_status, note, requested_by_account_id
  )
  values (
    p_pocket_id, v_pocket.profile_id, 'withdraw', v_amount, 'pending', v_note, v_user
  )
  returning id into v_tx_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  select a.id, 'account', 'savings_withdraw_pending',
    (select name from public.child_profiles where id = v_pocket.profile_id)
    || ' mengajukan penarikan ' || v_amount::text || ' dari «' || v_pocket.name || '».'
    || coalesce(' Catatan: ' || v_note, '')
  from public.accounts a
  where a.family_id = v_family_id
    and a.role in ('primary_parent', 'secondary_parent');

  return v_tx_id;
end;
$$;

revoke all on function public.request_savings_withdraw (uuid, int, text) from public;
grant execute on function public.request_savings_withdraw (uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: approve_savings_withdraw
-- ---------------------------------------------------------------------------

create or replace function public.approve_savings_withdraw (p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_tx public.savings_transactions%rowtype;
  v_pocket public.savings_pockets%rowtype;
  v_family_id uuid;
  v_balance int;
  v_ledger_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_tx
  from public.savings_transactions
  where id = p_transaction_id
  for update;
  if not found or v_tx.kind <> 'withdraw' or v_tx.withdraw_status <> 'pending' then
    raise exception 'invalid_transaction';
  end if;

  select * into v_pocket from public.savings_pockets where id = v_tx.pocket_id;

  select c.family_id into v_family_id
  from public.child_profiles c where c.id = v_tx.profile_id;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user
      and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  v_balance := public.compute_savings_pocket_balance(v_tx.pocket_id);
  if v_balance < v_tx.amount then
    raise exception 'insufficient_pocket' using errcode = 'P0001';
  end if;

  insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
  values (v_tx.profile_id, v_user, v_tx.amount, 'savings_withdraw', null)
  returning id into v_ledger_id;

  update public.savings_transactions
  set withdraw_status = 'approved',
      ledger_id = v_ledger_id,
      reviewed_by_account_id = v_user,
      reviewed_at = now()
  where id = p_transaction_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    v_tx.profile_id,
    'profile',
    'savings_withdraw_approved',
    'Penarikan ' || v_tx.amount::text || ' dari kantong «' || v_pocket.name
      || ' disetujui! Energi kembali ke dompetmu.'
  );
end;
$$;

revoke all on function public.approve_savings_withdraw (uuid) from public;
grant execute on function public.approve_savings_withdraw (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: reject_savings_withdraw
-- ---------------------------------------------------------------------------

create or replace function public.reject_savings_withdraw (
  p_transaction_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_tx public.savings_transactions%rowtype;
  v_pocket public.savings_pockets%rowtype;
  v_family_id uuid;
  v_reason text;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_tx
  from public.savings_transactions
  where id = p_transaction_id
  for update;
  if not found or v_tx.kind <> 'withdraw' or v_tx.withdraw_status <> 'pending' then
    raise exception 'invalid_transaction';
  end if;

  select * into v_pocket from public.savings_pockets where id = v_tx.pocket_id;

  select c.family_id into v_family_id
  from public.child_profiles c where c.id = v_tx.profile_id;

  if not exists (
    select 1 from public.accounts a
    where a.id = v_user
      and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  update public.savings_transactions
  set withdraw_status = 'rejected',
      reviewed_by_account_id = v_user,
      reviewed_at = now(),
      note = coalesce(v_reason, note)
  where id = p_transaction_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    v_tx.profile_id,
    'profile',
    'savings_withdraw_rejected',
    'Penarikan dari «' || v_pocket.name || '» ditolak.'
      || coalesce(' Alasan: ' || v_reason, '')
  );
end;
$$;

revoke all on function public.reject_savings_withdraw (uuid, text) from public;
grant execute on function public.reject_savings_withdraw (uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.savings_pockets;
    alter publication supabase_realtime add table public.savings_transactions;
  end if;
exception
  when duplicate_object then null;
end;
$$;

grant execute on function public.compute_wallet_balance (uuid) to authenticated;
grant execute on function public.compute_savings_pocket_balance (uuid) to authenticated;
grant execute on function public.compute_savings_reserved_balance (uuid) to authenticated;

