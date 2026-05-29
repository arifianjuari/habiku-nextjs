-- Streak «hari penuh»: berurutan ke belakang dari kemarin —
-- setiap misi aktif (frekuensi daily/custom) minimal satu task_history APPROVED
-- pada tanggal kalender tersebut (timezone keluarga). Satu tugas kosong → hari gagal → streak berhenti.
-- Misi weekly tidak masuk pemeriksaan harian (kuota mingguan; bisa ditindak lanjuti terpisah).

create or replace function public.profile_full_daily_mission_streak (p_profile_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_family_id uuid;
  d date;
  n int := 0;
  v_miss boolean;
begin
  if auth.uid () is null then
    raise exception 'not_authenticated';
  end if;

  select c.family_id
    into v_family_id
  from public.child_profiles c
  where c.id = p_profile_id;

  if v_family_id is null then
    return 0;
  end if;

  if not exists (
    select 1
    from public.accounts a
    where a.id = auth.uid ()
      and a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_tz := (
    select f.timezone from public.families f where f.id = v_family_id
  );

  if not exists (
    select 1
    from public.tasks t
    where t.profile_id = p_profile_id
      and t.is_active = true
      and t.frequency_type in ('daily', 'custom')
  ) then
    -- Tanpa misi harian/custom aktif tidak ada apa yang dinilai lulus.
    return 0;
  end if;

  -- Hari pertama yang boleh dihitung: kemarin (hari ini belum tertutup 23:59).
  d :=
    (
      timezone (coalesce (v_tz, 'UTC'), now ())
    )::date
    - 1;

  loop
    select exists (
      select 1
      from public.tasks t
      where t.profile_id = p_profile_id
        and t.is_active = true
        and t.frequency_type in ('daily', 'custom')
        and not exists (
          select 1
          from public.task_history th
          where th.task_id = t.id
            and th.profile_id = p_profile_id
            and th.status = 'approved'
            and th.approved_at is not null
            and (
              timezone (coalesce (v_tz, 'UTC'), th.approved_at)
            )::date = d
        )
    )
      into v_miss;

    exit when v_miss;

    n := n + 1;
    d := d - 1;

    exit when n >= 1095;
  end loop;

  return n;
end;
$$;

comment on function public.profile_full_daily_mission_streak (uuid) is
  'Berapa hari kalender berturut (timezone keluarga) semua misi aktif harian/custom mendapat approve; mulai menghitung dari kemarin.';

revoke all on function public.profile_full_daily_mission_streak (uuid) from public;

grant execute on function public.profile_full_daily_mission_streak (uuid) to authenticated;
