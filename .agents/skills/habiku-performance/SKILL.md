---
name: habiku-performance
description: >-
  Habiku-specific responsiveness and PWA performance patterns for Next.js App Router
  + Supabase + React Query. Use when adding routes, tabs, data fetching, server actions,
  PWA/service worker changes, or when the user reports slow loading, sluggish navigation,
  heavy submit buttons, or PWA cold start issues.
---

# Habiku Performance & Responsiveness

Panduan wajib untuk mencegah regresi performa di **habiku-nextjs**. Gunakan bersama skill `vercel-react-best-practices`; skill ini fokus pada **konvensi arsitektur Habiku** yang sudah terbukti.

## Kapan skill ini wajib dipakai

- Menambah route/tab baru di `/parent/*` atau `/child/*`
- Menambah fetch Supabase di server component atau server action
- Mengubah layout, bottom nav, prefetch, atau service worker
- User melaporkan: loading awal berat, tab switch lambat, tombol submit/setuju freeze, PWA terasa dingin setelah idle

## Prinsip arsitektur (jangan dilanggar)

### 1. Tab navigasi = client-first + React Query

**Parent tabs** (Misi, Target, Tabungan) dan **child tabs** harus:

| Layer | Tanggung jawab |
|-------|----------------|
| Server `page.tsx` | Auth saja (`getSessionContext` / redirect) + pass `familyId` atau `profileId` |
| Client page wrapper | `useQuery` + skeleton |
| View besar | `next/dynamic` via [`components/parent/parent-dynamic-views.tsx`](../../../components/parent/parent-dynamic-views.tsx) |

**Jangan** fetch data berat di RSC page untuk tab yang diakses via bottom nav — itu memicu round-trip server setiap klik.

Referensi implementasi:

- [`lib/parent/fetch-parent-tab-page-data.ts`](../../../lib/parent/fetch-parent-tab-page-data.ts)
- [`lib/hooks/use-parent-tasks-data.ts`](../../../lib/hooks/use-parent-tasks-data.ts)
- [`components/parent/parent-tasks-page-client.tsx`](../../../components/parent/parent-tasks-page-client.tsx)
- Child: [`lib/child/fetch-child-data.ts`](../../../lib/child/fetch-child-data.ts) + hooks `use-child-*-data.ts`

### 2. Prefetch query key HARUS sama dengan hook

Anti-pattern yang pernah terjadi: prefetch menulis cache key A, hook membaca key B → prefetch tidak berguna.

```typescript
// ✅ Satu sumber query key
export function parentTasksPageQueryKey(familyId: string) {
  return [...parentQueryKeys.tasks(familyId), "page"] as const;
}

// Prefetch
queryClient.prefetchQuery({ queryKey: parentTasksPageQueryKey(familyId), queryFn: ... });

// Hook
useQuery({ queryKey: parentTasksPageQueryKey(familyId), queryFn: ... });
```

Prefetch idle: [`components/parent/parent-tab-prefetch.tsx`](../../../components/parent/parent-tab-prefetch.tsx), [`components/child/child-tab-prefetch.tsx`](../../../components/child/child-tab-prefetch.tsx).

### 3. Layout shell sync, data async

- [`app/parent/layout.tsx`](../../../app/parent/layout.tsx) — **sync**, tidak `await getSessionContext()`
- `familyId` untuk bottom nav: [`components/layout/parent-bottom-nav-slot.tsx`](../../../components/layout/parent-bottom-nav-slot.tsx) + Suspense
- Halaman berat: Suspense + skeleton ([`components/shared/page-loading-skeleton.tsx`](../../../components/shared/page-loading-skeleton.tsx))

### 4. Dedup query server

- Children keluarga: **satu sumber** [`getFamilyChildren`](../../../lib/parent/parent-home-data.ts) (`React.cache`)
- Jangan duplikasi `fetchFamilyChildren` tanpa cache di page yang sama
- Child home fase 2: hoist `family_settings`, pass shared Supabase client — lihat [`lib/child/fetch-child-data.ts`](../../../lib/child/fetch-child-data.ts)

### 5. Mutasi / submit — jangan refresh penuh

| ❌ Hindari | ✅ Ganti dengan |
|-----------|----------------|
| `router.refresh()` setelah approve/setujui sukses | Optimistic UI + rollback state lokal on error |
| `router.refresh()` di realtime | `queryClient.invalidateQueries({ queryKey: ["parent"] })` |
| `revalidatePath` ke 3–5 route sekaligus | Hanya path yang benar-benar perlu (mis. `/parent/queue` saja) |

Server actions tetap boleh `revalidatePath` **minimal**; client jangan trigger full RSC refresh.

### 6. Bundle & view besar

- View parent >500 baris **wajib** lewat [`parent-dynamic-views.tsx`](../../../components/parent/parent-dynamic-views.tsx)
- `optimizePackageImports` untuk `lucide-react` + `framer-motion` di [`next.config.ts`](../../../next.config.ts)
- Provider non-kritis (Toaster, analytics): `next/dynamic` + `{ ssr: false }`

### 7. PWA / Service Worker

File: [`public/sw.js`](../../../public/sw.js)

| ✅ Boleh pre-cache | ❌ Jangan pre-cache |
|-------------------|-------------------|
| `/offline`, manifest, icons | Route HTML (`/parent/*`, `/child/*`) |
| Asset statis kecil | Halaman yang butuh auth + RSC |

Alasan: pre-cache route HTML saat install PWA = banyak request auth/RSC → install dan cold start terasa berat.

SW **bypass** request RSC (`RSC: 1`, `Next-Router-Prefetch`) — navigasi client Next.js tidak lewat cache HTML SW.

Registrasi SW: defer via `requestIdleCallback` di [`components/shared/pwa-provider.tsx`](../../../components/shared/pwa-provider.tsx).

**Setiap perubahan strategi cache SW → bump `CACHE_NAME` version.**

### 8. Signed URL avatar

- Cache + in-flight dedup: [`lib/storage/signed-url-cache.ts`](../../../lib/storage/signed-url-cache.ts)
- Prefetch list: [`lib/hooks/use-prefetch-child-avatar-urls.ts`](../../../lib/hooks/use-prefetch-child-avatar-urls.ts) di queue & profil anak

### 9. Child mode hydration

- Cookie sync sebelum Zustand selesai: [`lib/stores/child-mode-store.ts`](../../../lib/stores/child-mode-store.ts)
- Jangan block render child >150ms tanpa alasan

## Checklist sebelum merge (route/tab baru)

Lihat [checklist.md](checklist.md).

## Pola kode

Lihat [patterns.md](patterns.md).

## Verifikasi

Setelah perubahan performa, ikuti [`docs/performance-verification.md`](../../../docs/performance-verification.md):

1. Hitung request Supabase per navigasi tab
2. Uji tab switch setelah prefetch warm (~2s di `/parent`)
3. PWA: reinstall SW setelah ubah `sw.js`
4. `pnpm build` harus lulus

## Anti-patterns yang pernah menyebabkan regresi

1. **Server-heavy parent tabs** — prefetch React Query ada tapi page tetap `await` 4–6 query DB
2. **Prefetch key mismatch** — cache tidak pernah dipakai saat navigasi
3. **Layout async blocking** — shell header/nav menunggu `getSessionContext`
4. **3× query `child_profiles`** — parallel tapi duplikat
5. **SW pre-cache HTML routes** — install PWA lambat
6. **`router.refresh()` on error** — rollback sudah ada tapi tetap full refresh

## Relasi skill lain

- `vercel-react-best-practices` — aturan React/Next.js umum
- `supabase` — RLS, query, migrations
- Jangan duplikasi isi keduanya; rujuk skill ini untuk **konvensi Habiku**
