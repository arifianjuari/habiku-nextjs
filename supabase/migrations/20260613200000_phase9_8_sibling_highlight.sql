-- Fase 9.8: Sorotan saudara — RPC deterministik per (family, day) untuk
-- memilih 1 saudara dengan aktivitas terkini sebagai sumber motivasi
-- non-kompetitif. Hanya aktif jika `family_settings.show_sibling_highlight`.
--
-- Strategi:
--   - Saudara = profil di family yang sama, BUKAN p_profile_id.
--   - Kandidat = saudara yang punya >=1 task_history.approved dalam 24 jam.
--   - Bila tidak ada kandidat, return tabel kosong.
--   - Pemilihan deterministik: order by md5(profile_id::text || day::text).

create or replace function public.pick_sibling_highlight (
  p_profile_id uuid,
  p_day date default null
)
returns table (
  sibling_id uuid,
  sibling_name text,
  approved_recent int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day date;
  v_family_id uuid;
  v_caller_family uuid;
  v_caller_account uuid;
  v_enabled boolean;
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

  -- Validasi caller (akun ortu sefamily atau profil anak yang sama).
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

  -- Cek opt-in.
  select coalesce(fs.show_sibling_highlight, false) into v_enabled
  from public.family_settings fs
  where fs.family_id = v_family_id;
  if not coalesce(v_enabled, false) then
    return;
  end if;

  if p_day is null then
    select (timezone(coalesce(f.timezone, 'UTC'), now()))::date
      into v_day
    from public.families f
    where f.id = v_family_id;
  else
    v_day := p_day;
  end if;

  return query
  with siblings as (
    select c.id, c.name
    from public.child_profiles c
    where c.family_id = v_family_id
      and c.id <> p_profile_id
  ),
  recent as (
    select th.profile_id, count(*)::int as n
    from public.task_history th
      join siblings s on s.id = th.profile_id
    where th.status = 'approved'
      and th.approved_at >= now() - interval '24 hours'
    group by th.profile_id
  )
  select
    s.id as sibling_id,
    s.name as sibling_name,
    coalesce(r.n, 0) as approved_recent
  from siblings s
    join recent r on r.profile_id = s.id
  order by md5(s.id::text || v_day::text)
  limit 1;
end;
$$;

revoke all on function public.pick_sibling_highlight (uuid, date) from public;
grant execute on function public.pick_sibling_highlight (uuid, date) to authenticated;

comment on function public.pick_sibling_highlight (uuid, date) is
  'Fase 9.8: pilih 1 saudara dengan aktivitas approved terkini per (family, day) '
  'untuk strip motivasi non-kompetitif. Hanya aktif jika opt-in.';
