# Supabase — Habiku

## Dokumentasi skema (sumber kebenaran)

**[`docs/database-architecture.md`](../docs/database-architecture.md)** — ERD, tabel, enum, RLS, triggers, RPC, Storage buckets.

Tipe TypeScript di `types/database.ts` diselaraskan dengan dokumen itu (manual). Setelah migrasi terpasang, generate ulang:

```bash
supabase gen types typescript --linked > types/database.ts
```

## Setup

1. Salin folder `supabase/migrations` dari repositori aplikasi lama (Expo), atau
2. `supabase link --project-ref <your-ref>`
3. `supabase db push`

## Edge Functions (reuse)

- `mark-missed-tick`
- `notify-parents-task-pending`
- `notify-parents-goal-request`

## Catatan Web vs Expo

- Tabel `account_push_tokens` saat ini berisi `expo_push_token` (mobile). Untuk Web Push (W4), rencanakan tabel/kolom tambahan atau migrasi terpisah — lihat PRD Next.js §7.3.
