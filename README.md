# Habiku — Next.js

Aplikasi web **Habiku** (pembentukan karakter anak) — stack **Next.js + Supabase**.

## Dokumentasi

- [PRD Next.js](./docs/prd-habiku-nextjs.md)
- [Arsitektur database](./docs/database-architecture.md) — skema PostgreSQL, RLS, RPC
- [PRD referensi React Native](./docs/prd-habiku-react.md)
- [Roadmap implementasi](./docs/implementation-roadmap-nextjs.md)
- [**Checklist environment (ditunda)**](./docs/deployment-env-checklist.md) — Supabase, VAPID, `CRON_SECRET`
- [Spesifikasi W7 — Tabungan digital](./docs/w7-tabungan-digital.md)

## Prasyarat

- Node.js ≥ 20
- pnpm
- Proyek Supabase (atau Supabase CLI lokal)

## Mulai cepat

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local — isi URL & anon key Supabase Anda
pnpm dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Skrip

| Perintah | Fungsi |
|----------|--------|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Jalankan build |
| `pnpm lint` | ESLint |

## Struktur utama

```
app/                # App Router (marketing, auth, parent, child)
components/         # UI + layout + domain components
lib/
  database/         # enum domain, nama RPC
  supabase/         # klien SSR + helper RPC typed
  auth/             # session context (accounts + families)
types/database.ts   # Tipe tabel (manual ↔ database-architecture.md)
supabase/           # Migrasi & Edge Functions (salin dari repo lama)
```

## Database

Salin migrasi dari repositori Expo/React Native ke `supabase/migrations`, lalu:

```bash
supabase link --project-ref <ref>
supabase db push
supabase gen types typescript --linked > types/database.ts
```

## Deploy

Deploy ke [Vercel](https://vercel.com) dengan environment variables dari `.env.example`.

## Lisensi

Private — Habiku.
