-- Misi insidental: apresiasi sekali jalan dari ortu, di luar rutinitas misi.
-- - Tabel `incidental_rewards` menyimpan metadata (judul, catatan, kategori, alokasi).
-- - RPC `give_incidental_reward` memvalidasi akses ortu, lalu menulis ledger
--   (type='earn', task_history_id null) + opsi `goal_progress_events` jika HP > 0.

create table public.incidental_rewards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.child_profiles (id) on delete cascade,
  granted_by_account_id uuid references public.accounts (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 80),
  note text check (note is null or char_length(note) <= 200),
  category public.task_category not null default 'lainnya',
  hp_to_target int not null default 0 check (hp_to_target >= 0 and hp_to_target <= 50),
  energy_only int not null default 0 check (energy_only >= 0 and energy_only <= 50),
  goal_id uuid references public.goals (id) on delete set null,
  hp_ledger_id uuid references public.point_ledger (id) on delete set null,
  energy_ledger_id uuid references public.point_ledger (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Setidaknya salah satu kanal harus > 0 (validasi RPC juga melindungi ini).
  check (hp_to_target > 0 or energy_only > 0),
  -- Bila HP > 0 wajib menyertakan goal_id.
  check (hp_to_target = 0 or goal_id is not null)
);

create index incidental_rewards_profile_id_idx
  on public.incidental_rewards (profile_id, created_at desc);
create index incidental_rewards_goal_id_idx
  on public.incidental_rewards (goal_id);

comment on table public.incidental_rewards is
  'Apresiasi sekali jalan dari ortu di luar rutinitas misi; merujuk ledger row(s) yang dibuat saat itu juga.';

alter table public.incidental_rewards enable row level security;

-- SELECT: anggota keluarga yang sama dengan profil anak.
create policy incidental_rewards_select_family on public.incidental_rewards
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.child_profiles c
      join public.accounts a on a.family_id = c.family_id
      where c.id = incidental_rewards.profile_id
        and a.id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE hanya lewat RPC `security definer` di bawah; tutup akses langsung.
revoke insert, update, delete on public.incidental_rewards from public;

-- ---------------------------------------------------------------------------
-- RPC: give_incidental_reward
-- ---------------------------------------------------------------------------

create or replace function public.give_incidental_reward (
  p_profile_id uuid,
  p_title text,
  p_note text,
  p_category public.task_category,
  p_hp_to_target int,
  p_energy_only int,
  p_goal_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_family_id uuid;
  v_title text;
  v_note text;
  v_hp int;
  v_energy int;
  v_goal public.goals%rowtype;
  v_hp_room int;
  v_hp_add int;
  v_hp_new int;
  v_hp_ledger_id uuid;
  v_energy_ledger_id uuid;
  v_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if char_length(v_title) = 0 then
    raise exception 'title_required' using errcode = 'P0001';
  end if;
  if char_length(v_title) > 80 then
    v_title := substring(v_title from 1 for 80);
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 200 then
    v_note := substring(v_note from 1 for 200);
  end if;

  v_hp := greatest(0, coalesce(p_hp_to_target, 0));
  v_energy := greatest(0, coalesce(p_energy_only, 0));
  if v_hp > 50 then v_hp := 50; end if;
  if v_energy > 50 then v_energy := 50; end if;
  if v_hp = 0 and v_energy = 0 then
    raise exception 'amount_required' using errcode = 'P0001';
  end if;

  select c.family_id into v_family_id
  from public.child_profiles c
  where c.id = p_profile_id;
  if v_family_id is null then
    raise exception 'profile_not_found';
  end if;

  if not exists (
    select 1
    from public.accounts a
    where a.id = v_user
      and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_hp > 0 then
    if p_goal_id is null then
      raise exception 'goal_required' using errcode = 'P0001';
    end if;
    select * into v_goal
    from public.goals
    where id = p_goal_id
      and profile_id = p_profile_id
      and status = 'active'
    for update;
    if not found then
      raise exception 'invalid_goal' using errcode = 'P0001';
    end if;
  end if;

  -- Kanal HP target → ledger earn + goal_progress_events + update goals.current_hp.
  if v_hp > 0 then
    v_hp_room := greatest(0, v_goal.target_hp - v_goal.current_hp);
    v_hp_add := least(v_hp, v_hp_room);
    if v_hp_add > 0 then
      insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
      values (p_profile_id, v_user, v_hp_add, 'earn', null)
      returning id into v_hp_ledger_id;

      insert into public.goal_progress_events (profile_id, goal_id, ledger_id, amount)
      values (p_profile_id, v_goal.id, v_hp_ledger_id, v_hp_add);

      v_hp_new := v_goal.current_hp + v_hp_add;
      update public.goals
      set
        current_hp = v_hp_new,
        status = case when v_hp_new >= target_hp then 'completed'::public.goal_status else v_goal.status end,
        updated_at = now()
      where id = v_goal.id;
    end if;
  end if;

  -- Kanal energi umum → ledger earn tanpa task_history_id & tanpa goal_progress_events.
  if v_energy > 0 then
    insert into public.point_ledger (profile_id, account_id, amount, type, task_history_id)
    values (p_profile_id, v_user, v_energy, 'earn', null)
    returning id into v_energy_ledger_id;
  end if;

  insert into public.incidental_rewards (
    profile_id,
    granted_by_account_id,
    title,
    note,
    category,
    hp_to_target,
    energy_only,
    goal_id,
    hp_ledger_id,
    energy_ledger_id
  )
  values (
    p_profile_id,
    v_user,
    v_title,
    v_note,
    coalesce(p_category, 'lainnya'),
    v_hp,
    v_energy,
    case when v_hp > 0 then v_goal.id else null end,
    v_hp_ledger_id,
    v_energy_ledger_id
  )
  returning id into v_id;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    p_profile_id,
    'profile',
    'incidental_reward',
    'Energi insidental: ' || v_title ||
      case when v_hp > 0 then ' · +' || v_hp::text || ' HP target' else '' end ||
      case when v_energy > 0 then ' · +' || v_energy::text || ' energi' else '' end
  );

  return v_id;
end;
$$;

revoke all on function public.give_incidental_reward (
  uuid, text, text, public.task_category, int, int, uuid
) from public;

grant execute on function public.give_incidental_reward (
  uuid, text, text, public.task_category, int, int, uuid
) to authenticated;
