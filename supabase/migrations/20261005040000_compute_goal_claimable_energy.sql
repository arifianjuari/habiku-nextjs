-- Energi yang tertahan di goal berstatus 'ready_to_claim'.
--
-- Kebutuhan UX: layar tabungan anak memakai compute_savable_goal_energy, yang hanya
-- menjumlahkan goal 'active'. Begitu sebuah goal mencapai target, statusnya pindah ke
-- 'ready_to_claim' dan energinya hilang dari angka "Bisa ditabung" — padahal dompet
-- tetap menampilkannya. Anak melihat dompet berisi tetapi "bisa ditabung" nol tanpa
-- penjelasan apa pun.
--
-- Fungsi ini memberi angka yang hilang itu supaya UI bisa menjelaskannya, bukan
-- mengubah aturan mana energi yang boleh ditabung.

create or replace function public.compute_goal_claimable_energy (p_profile_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce(sum(current_hp), 0)::int
  from public.goals
  where profile_id = p_profile_id
    and status = 'ready_to_claim';
$$;

comment on function public.compute_goal_claimable_energy is
  'Total current_hp goal berstatus ready_to_claim. Pelengkap compute_savable_goal_energy '
  '(yang hanya menghitung goal active) agar UI bisa menjelaskan energi yang tertahan.';

grant execute on function public.compute_goal_claimable_energy to authenticated;
