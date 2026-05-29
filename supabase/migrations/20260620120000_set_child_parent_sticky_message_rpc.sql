-- Ortu: set / hapus sticky note per-anak (`parent_sticky_message`).
-- Klien tidak punya UPDATE langsung pada child_profiles (Fase 3); gunakan RPC ini.

create or replace function public.set_child_parent_sticky_message (
  p_profile_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if public.current_account_role() is distinct from 'primary_parent'
     and public.current_account_role() is distinct from 'secondary_parent' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.child_profiles c
    where c.id = p_profile_id
      and c.family_id = public.current_family_id()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.child_profiles
  set
    parent_sticky_message = case
      when p_message is null or btrim(p_message) = '' then null
      else left(btrim(p_message), 280)
    end,
    updated_at = now()
  where id = p_profile_id;
end;
$fn$;

revoke all on function public.set_child_parent_sticky_message (uuid, text) from public;
grant execute on function public.set_child_parent_sticky_message (uuid, text) to authenticated;

comment on function public.set_child_parent_sticky_message (uuid, text) is
  'Ortu: sticky note pribadi per anak (parent_sticky_message); null atau string kosong menghapus.';
