-- Harus migrasi terpisah: PostgreSQL melarang memakai nilai enum baru dalam transaksi yang sama
-- sebelum commit (55P04). File berikutnya memakai 'missed' di index & fungsi.

alter type public.task_history_status add value if not exists 'missed';
