-- Saat pengajuan target disetujui/ditolak, anak dapat baris in-app (recipient_type = profile),
-- konsisten dengan task_approved di approve_task_history.

create or replace function public.approve_goal_request (p_request_id uuid, p_target_hp int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_title text;
  v_goal_id uuid;
  v_title_short text;
begin
  if p_target_hp is null or p_target_hp < 1 then
    raise exception 'invalid_hp' using errcode = 'P0001';
  end if;

  if public.current_account_role() is distinct from 'primary_parent'
     and public.current_account_role() is distinct from 'secondary_parent' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select gr.profile_id, gr.title
  into v_profile_id, v_title
  from public.goal_requests gr
  join public.child_profiles c on c.id = gr.profile_id
  where gr.id = p_request_id
    and gr.status = 'pending'
    and c.family_id = public.current_family_id();

  if v_profile_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.goals (profile_id, title, target_hp, current_hp, status)
  values (v_profile_id, trim(both from v_title), p_target_hp, 0, 'active')
  returning id into v_goal_id;

  update public.goal_requests
  set
    status = 'approved',
    created_goal_id = v_goal_id,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = p_request_id;

  v_title_short := left(trim(both from coalesce(v_title, '')), 120);
  if v_title_short = '' then
    v_title_short := 'Target';
  end if;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    v_profile_id,
    'profile',
    'goal_request_approved',
    'Orang tua menyetujui target «' || v_title_short || '». Kumpulkan '
      || p_target_hp::text || ' energi untuk hadiahmu.'
  );

  return v_goal_id;
end;
$$;

create or replace function public.reject_goal_request (p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req_id uuid;
  v_profile_id uuid;
  v_title text;
  v_title_short text;
begin
  if public.current_account_role() is distinct from 'primary_parent'
     and public.current_account_role() is distinct from 'secondary_parent' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select gr.id, gr.profile_id, gr.title
  into v_req_id, v_profile_id, v_title
  from public.goal_requests gr
  join public.child_profiles c on c.id = gr.profile_id
  where gr.id = p_request_id
    and gr.status = 'pending'
    and c.family_id = public.current_family_id();

  if v_req_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  update public.goal_requests gr
  set
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where gr.id = p_request_id
    and gr.status = 'pending';

  v_title_short := left(trim(both from coalesce(v_title, '')), 120);
  if v_title_short = '' then
    v_title_short := 'Target';
  end if;

  insert into public.notifications (recipient_id, recipient_type, type, content)
  values (
    v_profile_id,
    'profile',
    'goal_request_rejected',
    'Pengajuan «' || v_title_short || '» belum disetujui orang tua kali ini. Tanya orang tua ya kalau perlu.'
  );
end;
$$;

comment on function public.approve_goal_request (uuid, int) is
  'Ortu: setujui pengajuan anak, buat goals aktif, notifikasi in-app ke profil anak.';

comment on function public.reject_goal_request (uuid) is
  'Ortu: tolak pengajuan; notifikasi in-app ke profil anak.';
