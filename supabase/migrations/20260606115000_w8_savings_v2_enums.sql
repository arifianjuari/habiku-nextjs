-- W8 enums — file terpisah agar nilai enum baru bisa dipakai di migrasi berikutnya (Postgres 55P04).

alter type public.goal_status add value if not exists 'ready_to_claim';

create type public.savings_pocket_type as enum ('flexible', 'term');

alter type public.savings_tx_kind add value if not exists 'interest';

alter type public.ledger_type add value if not exists 'savings_interest';
alter type public.ledger_type add value if not exists 'goal_redeem_spend';

create type public.goal_claim_status as enum ('pending', 'approved', 'rejected');
