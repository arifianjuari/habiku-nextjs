-- Habiku — Fase 2.4: undangan orang tua kedua (secondary parent) + token aman
-- Deep link klien: habiku://invite/<token> (Expo scheme)

-- ---------------------------------------------------------------------------
-- Tabel undangan
-- ---------------------------------------------------------------------------

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_by uuid not null references public.accounts (id) on delete cascade,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index family_invites_family_id_idx on public.family_invites (family_id);

comment on table public.family_invites is
  'Token undangan secondary_parent; konsumsi sekali via accept_family_invite.';

alter table public.family_invites enable row level security;

revoke all on public.family_invites from public;

-- ---------------------------------------------------------------------------
-- RPC: Primary Parent membuat undangan (mengembalikan token untuk dibagikan)
-- ---------------------------------------------------------------------------

create or replace function public.create_family_invite ()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family uuid;
  v_role public.account_role;
  v_token text;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  select a.family_id, a.role into v_family, v_role
  from public.accounts a
  where a.id = v_user;
  if v_family is null then
    raise exception 'No family account';
  end if;
  if v_role is distinct from 'primary_parent' then
    raise exception 'Only primary parent can create invites';
  end if;
  insert into public.family_invites (family_id, created_by)
  values (v_family, v_user)
  returning token into v_token;
  return v_token;
end;
$$;

revoke all on function public.create_family_invite () from public;
grant execute on function public.create_family_invite () to authenticated;

comment on function public.create_family_invite () is
  'Ortu utama: buat token undangan anggota keluarga (secondary).';

-- ---------------------------------------------------------------------------
-- RPC: Akun auth yang belum punya baris accounts menyelesaikan undangan
-- ---------------------------------------------------------------------------

create or replace function public.accept_family_invite (p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_inv public.family_invites%rowtype;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from public.accounts where id = v_user) then
    raise exception 'Account already belongs to a family';
  end if;
  if p_token is null or length(trim(p_token)) < 8 then
    raise exception 'Invalid invite token';
  end if;
  select *
  into v_inv
  from public.family_invites
  where token = trim(p_token)
    and consumed_at is null
    and expires_at > now();
  if v_inv.id is null then
    raise exception 'Invalid or expired invite';
  end if;
  insert into public.accounts (id, family_id, role)
  values (v_user, v_inv.family_id, 'secondary_parent');
  update public.family_invites
  set consumed_at = now()
  where id = v_inv.id;
  return v_inv.family_id;
end;
$$;

revoke all on function public.accept_family_invite (text) from public;
grant execute on function public.accept_family_invite (text) to authenticated;

comment on function public.accept_family_invite (text) is
  'Panggil setelah login/signup:ikat pengguna sebagai secondary_parent pada keluarga undangan.';
