-- FSD §3: status visual target untuk kartu/detail mode anak & hub ortu (bukan hukuman).
alter table public.goals
  add column if not exists visual_state text not null default 'fresh';

alter table public.goals drop constraint if exists goals_visual_state_allowed;
alter table public.goals
  add constraint goals_visual_state_allowed
  check (
    visual_state in ('fresh', 'slightly_wilted', 'wilted', 'dormant')
  );

comment on column public.goals.visual_state is
  'Metafora tampilan target (segara/layu/dormant). Diisi backend/RPC; default fresh.';
