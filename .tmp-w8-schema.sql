-- ---------------------------------------------------------------------------
-- family_settings
-- ---------------------------------------------------------------------------

alter table public.family_settings
  add column if not exists goal_save_enabled boolean not null default true,
  add column if not exists savings_interest_enabled boolean not null default true,
  add column if not exists max_monthly_interest_bps int not null default 500
    check (max_monthly_interest_bps >= 0 and max_monthly_interest_bps <= 2000);

-- ---------------------------------------------------------------------------
-- savings_pockets v2 columns
-- ---------------------------------------------------------------------------

alter table public.savings_pockets
  add column if not exists pocket_type public.savings_pocket_type not null default 'flexible',
  add column if not exists monthly_interest_bps int not null default 0
    check (monthly_interest_bps >= 0 and monthly_interest_bps <= 2000),
  add column if not exists lock_months int check (lock_months is null or (lock_months >= 1 and lock_months <= 36)),
  add column if not exists lock_bonus_coefficient numeric(6, 2) not null default 1.0
    check (lock_bonus_coefficient >= 0.1 and lock_bonus_coefficient <= 5.0),
  add column if not exists default_for_goal_save boolean not null default false;

create unique index if not exists savings_pockets_one_default_goal_save_idx
  on public.savings_pockets (profile_id)
  where default_for_goal_save = true and is_active = true;

-- ---------------------------------------------------------------------------
-- savings_transactions v2 columns
-- ---------------------------------------------------------------------------

alter table public.savings_transactions
  add column if not exists locked_until timestamptz,
  add column if not exists interest_accrued int not null default 0 check (interest_accrued >= 0),
  add column if not exists principal_snapshot int check (principal_snapshot is null or principal_snapshot > 0),
  add column if not exists last_interest_at timestamptz;

alter table public.savings_transactions
  drop constraint if exists savings_transactions_check;

alter table public.savings_transactions
  add constraint savings_transactions_check check (
    (kind = 'deposit' and withdraw_status is null)
    or (kind = 'withdraw' and withdraw_status is not null)
    or (kind = 'interest' and withdraw_status is null and ledger_id is not null)
  );

-- ---------------------------------------------------------------------------
-- goal_claim_requests
-- ---------------------------------------------------------------------------

create table public.goal_claim_requests (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  status public.goal_claim_status not null default 'pending',
  requested_by_account_id uuid references public.accounts (id) on delete set null,
  reviewed_by_account_id uuid references public.accounts (id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 200),
  created_at timestamptz not null default now()
);

create unique index goal_claim_requests_one_pending_per_goal_idx
  on public.goal_claim_requests (goal_id)
  where status = 'pending';

create index goal_claim_requests_profile_pending_idx
  on public.goal_claim_requests (profile_id, status)
  where status = 'pending';

alter table public.goal_claim_requests enable row level security;

create policy goal_claim_requests_select_family on public.goal_claim_requests
  for select to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = goal_claim_requests.profile_id
        and a.id = auth.uid()
    )
  );

revoke insert, update, delete on public.goal_claim_requests from public;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.resolve_goal_status_on_hp_reached (
  p_current_status public.goal_status,
  p_new_hp int,
  p_target_hp int,
  p_family_id uuid
)
returns public.goal_status
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_goal_save boolean;
begin
  if p_new_hp < p_target_hp then
    return p_current_status;
  end if;

  select coalesce(fs.goal_save_enabled, true)
  into v_goal_save
  from public.family_settings fs
  where fs.family_id = p_family_id;

  if coalesce(v_goal_save, true) then
    return 'ready_to_claim'::public.goal_status;
  end if;

  return 'completed'::public.goal_status;
end;
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
      when kind in ('deposit', 'interest') then amount
      when kind = 'withdraw' and withdraw_status = 'approved' then -amount
      else 0
    end
  ), 0)::int
  from public.savings_transactions
  where pocket_id = p_pocket_id;
$$;

create or replace function public.pocket_is_locked (p_pocket_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.savings_pockets p
    join public.savings_transactions t on t.pocket_id = p.id
    where p.id = p_pocket_id
      and p.pocket_type = 'term'
      and t.kind = 'deposit'
      and t.locked_until is not null
      and t.locked_until > now()
  );
$$;

create or replace function public.term_pocket_has_deposit (p_pocket_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.savings_transactions t
  join public.savings_pockets p on p.id = t.pocket_id
    where t.pocket_id = p_pocket_id
      and p.pocket_type = 'term'
      and t.kind = 'deposit'
  );
$$;