-- Ortu: set / hapus pesan broadcast «Semua anak» (`families.family_broadcast_message`).
-- Pola sama dengan `set_child_parent_sticky_message`: tulis lewat SECURITY DEFINER agar
-- tidak bergantung pada privilege UPDATE langsung / perilaku PostgREST «0 baris» yang sulit dilacak.

create or replace function public.set_family_broadcast_message (p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_fam uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if public.current_account_role() is distinct from 'primary_parent'
     and public.current_account_role() is distinct from 'secondary_parent' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_fam := public.current_family_id();
  if v_fam is null then
    raise exception 'no_family' using errcode = 'P0001';
  end if;

  update public.families
  set
    family_broadcast_message = case
      when p_message is null or btrim(p_message) = '' then null
      else left(btrim(p_message), 280)
    end
  where id = v_fam;

  if not found then
    raise exception 'Tidak ada baris keluarga yang diperbarui.' using errcode = 'P0001';
  end if;
end;
$fn$;

revoke all on function public.set_family_broadcast_message (text) from public;
grant execute on function public.set_family_broadcast_message (text) to authenticated;

comment on function public.set_family_broadcast_message (text) is
  'Ortu: pesan broadcast untuk semua anak (family_broadcast_message); null atau kosong menghapus.';
