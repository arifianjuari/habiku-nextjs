-- Fase 9.5: RPC `thank_broadcast_message` — anak mengirim reaksi "Terima kasih"
-- atas pesan broadcast ortu (`families.family_broadcast_message`).
--
-- Kontrak:
--   - p_profile_id: profil anak; harus berada di family yang sama dengan caller (auth.uid()).
--   - Mengirim notifikasi in-app ke semua akun ortu (recipient_type='account') di family.
--   - Tidak menulis tabel baru; debounce 1x/24 jam ditangani di klien (AsyncStorage)
--     untuk MVP. Idempotensi sisi server tidak ketat (boleh dikirim ulang) — beban
--     ringan: 1 INSERT per ortu (umumnya 1–2 baris).
--   - Tidak menyentuh `family_broadcast_message`; pesan tetap di `families`.

create or replace function public.thank_broadcast_message (
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_child_name text;
  v_message text;
  v_caller_account uuid;
  v_caller_family uuid;
  v_caller_role text;
  v_payload text;
  r record;
begin
  if p_profile_id is null then
    raise exception 'p_profile_id wajib diisi.';
  end if;

  -- Ambil family + nama anak.
  select c.family_id, c.name
    into v_family_id, v_child_name
    from public.child_profiles c
    where c.id = p_profile_id;

  if v_family_id is null then
    raise exception 'Profil anak tidak ditemukan.';
  end if;

  -- Validasi caller: harus akun di family yang sama (anak pakai akun ortu via mode anak)
  -- atau profil yang sama via JWT child mode. Pendekatan konservatif: cocokkan family_id
  -- dari salah satu jalur.
  select a.id, a.family_id, a.role
    into v_caller_account, v_caller_family, v_caller_role
    from public.accounts a
    where a.id = auth.uid();

  if v_caller_account is null then
    -- Mungkin caller adalah profil anak (auth via child token). Cek profile id == auth.uid().
    if exists (
      select 1 from public.child_profiles c2
      where c2.id = auth.uid() and c2.family_id = v_family_id
    ) then
      v_caller_family := v_family_id;
    else
      raise exception 'Tidak diizinkan: caller bukan anggota keluarga.';
    end if;
  end if;

  if v_caller_family is distinct from v_family_id then
    raise exception 'Tidak diizinkan: lintas keluarga.';
  end if;

  -- Ambil pesan terkini (untuk preview di notifikasi).
  select trim(both from coalesce(f.family_broadcast_message, ''))
    into v_message
    from public.families f
    where f.id = v_family_id;

  if v_message is null or v_message = '' then
    -- Tidak ada pesan aktif → diam-diam selesai (idempotent dari sisi anak).
    return;
  end if;

  if v_child_name is null or trim(v_child_name) = '' then
    v_child_name := 'Anak';
  end if;

  v_payload := v_child_name || ' mengucapkan terima kasih atas pesanmu: «'
    || left(v_message, 80)
    || case when char_length(v_message) > 80 then '…»' else '»' end;

  for r in
    select a.id as account_id
    from public.accounts a
    where a.family_id = v_family_id
      and a.role in ('primary_parent', 'secondary_parent')
  loop
    insert into public.notifications (recipient_id, recipient_type, type, content)
    values (
      r.account_id,
      'account',
      'broadcast_thanks',
      v_payload
    );
  end loop;
end;
$$;

revoke all on function public.thank_broadcast_message (uuid) from public;
grant execute on function public.thank_broadcast_message (uuid) to authenticated;

comment on function public.thank_broadcast_message (uuid) is
  'Fase 9.5: anak mengirim reaksi "Terima kasih" atas family_broadcast_message; '
  'notifikasi in-app ke semua akun ortu dalam family. Debounce 1x/24 jam di klien.';
