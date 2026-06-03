# Checklist env production (ditunda)

Isi variabel berikut di Vercel / Supabase **ketika siap** mengaktifkan push, cron, dan webhook internal. Aplikasi tetap berjalan tanpa ini; fitur terkait nonaktif atau terbatas.

| Variabel | Dampak jika kosong |
|----------|-------------------|
| `CRON_SECRET` | Route `/api/cron/*` menolak request — cron mark-missed & BigQuery sync tidak jalan |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push tidak terkirim |
| `INTERNAL_PUSH_SECRET` | Endpoint internal push tidak dapat dipanggil |
| Supabase service role (jika dipakai server-only) | Hanya jika ada job admin khusus |

**Tabungan digital (W7)** hanya membutuhkan migrasi DB + auth Supabase yang sudah ada.

**Pengingat:** setelah mengisi env, redeploy production dan uji satu cron + satu notifikasi push.
