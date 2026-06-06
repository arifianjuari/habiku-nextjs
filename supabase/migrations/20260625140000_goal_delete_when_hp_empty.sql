-- Izinkan hapus target yang sudah kosong (current_hp = 0), meski pernah ada di goal_hp_transfers.
-- Jejak transfer ikut terhapus (CASCADE); validasi sisa HP dilakukan di server action.

alter table public.goal_hp_transfers
  drop constraint if exists goal_hp_transfers_from_goal_id_fkey;

alter table public.goal_hp_transfers
  drop constraint if exists goal_hp_transfers_to_goal_id_fkey;

alter table public.goal_hp_transfers
  add constraint goal_hp_transfers_from_goal_id_fkey
    foreign key (from_goal_id) references public.goals (id) on delete cascade;

alter table public.goal_hp_transfers
  add constraint goal_hp_transfers_to_goal_id_fkey
    foreign key (to_goal_id) references public.goals (id) on delete cascade;
