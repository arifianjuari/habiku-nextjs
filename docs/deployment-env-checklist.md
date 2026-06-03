# Checklist Environment — Habiku (Production & Lokal)

Dokumen pengingat konfigurasi yang **belum diisi** di Vercel / `.env.local` (status: **ditunda** per keputusan produk, Juni 2026).

> Setelah mengisi, centang item di bawah dan hapus atau perbarui catatan "ditunda" di bagian atas.

---

## Status saat ini

| Variabel / grup | Status | Dampak jika kosong |
|-----------------|--------|---------------------|
| **Supabase** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | ⏳ Ditunda | Login, data, RLS — aplikasi tidak berfungsi penuh |
| **Service role** (`SUPABASE_SERVICE_ROLE_KEY`) | ⏳ Ditunda | Cron internal, webhook push, beberapa route server |
| **VAPID Web Push** (`NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_VAPID_SUBJECT`) | ⏳ Ditunda | Ortu tidak dapat notifikasi push browser saat misi pending |
| **Cron** (`CRON_SECRET`) | ⏳ Ditunda | `/api/cron/mark-missed-tick` & cron lain ditolak Vercel; FSD layu / missed task tidak jalan otomatis |
| **Webhook push** (`TASK_PENDING_WEBHOOK_SECRET`) | ⏳ Ditunda | Trigger push setelah submit misi dari server gagal otorisasi |

**Catatan:** Upgrade Vercel **Pro** sudah diperlukan untuk cron `0 * * * *` (tiap jam). Tanpa `CRON_SECRET` yang benar di env production, endpoint cron tetap mengembalikan 401.

---

## Referensi file

- Template: [`.env.example`](../.env.example)
- Panduan singkat: [`README.md`](../README.md) — bagian environment

---

## Langkah saat siap mengisi

1. **Supabase** — Dashboard → Project Settings → API → URL + anon key (+ service role untuk server only).
2. **VAPID** — Lokal: `npx web-push generate-vapid-keys` → public ke `NEXT_PUBLIC_*`, private ke `WEB_PUSH_VAPID_PRIVATE_KEY`.
3. **CRON_SECRET** — String acak panjang (≥ 32 karakter); sama di Vercel Production dan Preview jika dipakai.
4. **Vercel** — Project → Settings → Environment Variables → Production (dan Preview jika perlu).
5. **Redeploy** production setelah menyimpan env.
6. **Verifikasi:** submit misi anak → push (jika diaktifkan); tunggu/jalankan cron missed tick; cek log Vercel.

---

**Terakhir diperbarui:** 2026-06-03
