# Diagnosis Performa Habiku — Fondasi yang Masih Bermasalah

> Tanggal audit: 25 Agustus 2026 · Cakupan: audit baca-saja, tanpa perubahan kode.

## Latar belakang

Aplikasi masih terasa lemot di semua area: cold start PWA, sisi anak (`/child/*`), sisi
ortu (`/parent/*`), dan tombol submit/setujui.

Repo sudah punya konvensi performa di `.agents/skills/habiku-performance/SKILL.md`, dan
sebagian besar konvensi itu **sudah diikuti dengan benar**. Jadi pertanyaan yang dijawab
dokumen ini bukan "apa yang belum dioptimasi", melainkan **"kenapa optimasi yang sudah ada
tidak terasa"**.

Semua temuan di bawah sudah diverifikasi langsung terhadap kode dan terhadap project
Supabase produksi — bukan dugaan.

---

## Temuan kunci: ini bukan masalah database

Diverifikasi langsung ke project Supabase `ohnmeatnujnxeeeaaywv` (region `ap-southeast-1`):

| Ukuran | Nilai |
|--------|-------|
| Tabel terbesar | `notifications` — 1.979 baris |
| Berikutnya | `point_ledger` 666, `task_history` 587, `goal_progress_events` 558 |
| `child_profiles` | 9 baris |
| Waktu eksekusi query contoh | **1,9 ms** (`EXPLAIN ANALYZE`) |

Biaya eksekusi query praktis nol. Yang mahal adalah **jumlah round-trip berurutan ×
latensi per round-trip**, ditambah **berapa banyak JS yang harus di-parse sebelum layar
pertama terisi**. Seluruh laporan bertumpu pada dua sumbu itu.

Konfigurasi geografis saat ini: **Vercel Functions di Tokyo (`hnd1`)**, **Supabase di
Singapura (`ap-southeast-1`)**, **pengguna di Indonesia**. `vercel.json` tidak menyetel
`regions` sama sekali.

---

## Urutan prioritas (berdasarkan dampak yang dirasakan pengguna)

### F1 — HTML hasil render server di sisi anak dibuang percuma ⚠️ dampak terbesar

`components/child/child-mode-guard.tsx:46-57` mengembalikan `<PageLoadingSkeleton>`
selama `!hydrated || !sessionReady`. `useChildModeHydrated` selalu `false` di server
(`lib/stores/child-mode-store.ts:195-203`), dan guard ini membungkus **seluruh layout**
(`app/child/layout.tsx:13-25`).

Akibatnya untuk `/child/home`:
1. Server menjalankan ~14 query DB dalam 3 gelombang (`lib/child/fetch-child-data.ts:116-174`)
2. HTML hasilnya **tidak pernah dilihat pengguna** — klien menampilkan skeleton
3. Skeleton baru hilang setelah Zustand rehydrate dari `localStorage`, yang menuntut
   bundle JS terunduh + ter-parse penuh

Jadi semua kerja server di sisi anak nol manfaat untuk first paint. Ironisnya server
**sudah tahu** profile id dari cookie (`lib/child/get-server-child-profile-id.ts:7`) —
cookie yang sama yang ditunggu klien. Ada juga fallback timer 150 ms
(`child-mode-store.ts:15,223-230`) dan skeleton kedua yang bersarang di
`app/child/home/page.tsx:17`.

### F2 — Sisi anak nol code-splitting, sisi ortu penuh code-splitting

`next/dynamic` muncul **tepat di 2 file** se-repo, keduanya sisi ortu:
`components/parent/parent-dynamic-views.tsx` dan `lib/providers/app-providers.tsx`.

Semua halaman anak mengimpor view beratnya secara statis:

| LOC | Komponen | Diimpor statis dari |
|-----|----------|---------------------|
| 628 | `child-savings-view` | `app/child/savings/page.tsx:2` |
| 467 | `child-mission-complete-view` | `app/child/missions/[taskId]/page.tsx:5` |
| 414 | `child-home-view` | `app/child/home/page.tsx:4` |
| 319 | `child-missions-view` | `app/child/missions/page.tsx:2` |
| 290 | `child-targets-view` | `app/child/targets/page.tsx:2` |
| 252 | `child-badge-shelf` | `app/child/badges/page.tsx:2` |
| 228 | `child-reflection-view` | `app/child/reflection/page.tsx:2` |

Ditambah **framer-motion** (~50 kb gzip) diimpor statis oleh 7 view anak. Tidak ada
`LazyMotion`/`m` di mana pun — jadi yang ditarik adalah engine animasi DOM penuh, untuk
animasi yang isinya `{opacity:0,y:12} → {opacity:1,y:0}` (`child-home-view.tsx:37-40`).
Proyek sudah punya `tw-animate-css` di `package.json` yang bisa melakukan itu dengan CSS.

**Kombinasi F1+F2 adalah penyebab utama cold start terasa berat**: ponsel anak (biasanya
kelas bawah) mendapat bundle terbesar, dan layar menahan skeleton sampai seluruh bundle
itu selesai di-parse.

### F3 — 5 prefetch RSC eager per page load, masing-masing bayar 1 round-trip auth

`components/layout/parent-bottom-nav.tsx:45` dan `components/layout/child-bottom-nav.tsx:72`
sama-sama menyetel `prefetch={true}` pada 5 `<Link>`. Bottom nav `fixed` → selalu di
viewport → Next langsung prefetch **payload RSC penuh** kelima tab begitu halaman dimuat.

Setiap prefetch itu melewati middleware, yang memanggil `supabase.auth.getUser()` —
panggilan jaringan ke Singapura. Jadi: 5 round-trip auth lintas region + 5 render RSC
ekstra per page load, di atas prefetch React Query yang juga menyala untuk tab yang sama
(`parent-bottom-nav.tsx:28`, `child-bottom-nav.tsx:57`). `prefetch={null}` (default) hanya
akan prefetch layout bersama.

### F4 — `getUser()` di middleware bisa dijadikan verifikasi lokal (tanpa jaringan)

`lib/supabase/middleware.ts:43-45` menunggu `supabase.auth.getUser()` di setiap request
yang cocok matcher, dan **sebelum** percabangan path di baris 47-55 — jadi path yang tidak
butuh auth pun ikut membayar. `getUser()` selalu memanggil endpoint Supabase Auth untuk
validasi server-side.

**Namun**: endpoint JWKS project ini menyajikan kunci **ES256** (terverifikasi:
`GET /auth/v1/.well-known/jwks.json` → `{"alg":"ES256","kty":"EC","crv":"P-256",...}`).
Dengan kunci asimetris, `supabase.auth.getClaims()` memverifikasi JWT **secara lokal**
terhadap JWKS yang di-cache — nol round-trip. `@supabase/supabase-js` ^2.106.2 sudah
mendukungnya. Ini menghapus ~1 round-trip lintas region dari **setiap** request, termasuk
kelima prefetch di F3.

Tambahan: matcher saat ini masih mencakup `/api/*`, `/icon`, dan `/apple-icon`
(`middleware.ts:9-11` hanya mengecualikan `favicon.ico` dan `icons/`). Memindahkan cek
path ke atas panggilan auth akan melewatkannya sepenuhnya untuk rute-rute itu.

### F5 — Region Tokyo merugikan di kedua kaki

Fungsi di `hnd1`, DB di `ap-southeast-1`, pengguna di Indonesia. Singapura (`sin1`) lebih
dekat ke pengguna Indonesia **dan** satu region dengan DB — jadi memindahkan ke `sin1`
memperbaiki dua-duanya sekaligus:

| Kaki | Sekarang (hnd1) | Setelah sin1 |
|------|-----------------|--------------|
| Function ↔ DB (per round-trip) | ~70–85 ms | ~1–3 ms |
| Pengguna Jakarta ↔ edge | ~80–100 ms | ~20–35 ms |

Dengan 4–6 hop DB berurutan per halaman (lihat F6), ini sekitar **300–450 ms → ~15 ms**.
Perubahan satu baris `"regions": ["sin1"]` di `vercel.json`. *Angka RTT di atas adalah
estimasi tipikal — harus diukur langsung sebelum/sesudah, lihat bagian Verifikasi.*

### F6 — Waterfall: jumlah hop berurutan, bukan biaya query

Karena eksekusi query ~2 ms, yang menentukan hanyalah berapa hop yang tidak bisa paralel:

- **`/child/home`** — middleware `getUser` → gelombang 1 (5 query paralel) → gelombang 2
  (butuh `child.family_id`) → gelombang 3 (engagement + sticky + shared goal) =
  **4 hop berurutan, ~14 query** (`lib/child/fetch-child-data.ts:116-174`)
- **`/parent`** — middleware `getUser` → `getSessionContext` `getUser` → `accounts+families`
  → `getFamilyChildIds` = **4 hop**. `getFamilyChildIds` (`app/parent/page.tsx:28`) berada
  **di luar kedua batas Suspense**, jadi ia memblokir first byte padahal hanya dipakai untuk
  memberi props ke `ParentHomeRealtime` (komponen klien).
- **`/child/missions/[taskId]`** — `getSessionContext` (2 hop sendiri) → `await params` →
  select `tasks` = **4 hop**. `await params` di `app/child/missions/[taskId]/page.tsx:24`
  independen dan bisa diangkat ke atas.

**Query duplikat dalam satu request path:**
- `child_profiles` dibaca **3×** di `/child/home`: `fetch-child-data.ts:118` (`select("*")`),
  `:158` (saudara kandung), dan `load-sticky-messages.ts:53` — yang ketiga membaca ulang
  kolom `parent_sticky_message` yang **sudah ikut terbawa** oleh `select("*")` di `:118`.
  `loadStickyMessages` bahkan sudah punya jalur bypass `options.parentStickyMessage`
  (`:37,48`) yang dipakai jalur ortu tapi tidak dipakai jalur anak (`fetch-child-data.ts:169`).
- `child_profiles` dibaca **2×** di `/parent/goal/[childId]`: `generateMetadata` (baris 15-19)
  dan page body (baris 39-44), lewat 2 `createClient()` terpisah.
- `gold_transactions` dibaca **3×** di `/child/savings` (`lib/gold/fetch-gold.ts:255`, `:263`
  yang merupakan superset dari `:255`, dan `:190`).
- RPC saldo dompet dihitung **3×** per sesi di 3 cache key berbeda
  (`fetch-child-data.ts:119`, `:273`, `fetch-child-savings-client.ts:64`).
- `lib/supabase/server.ts:6` `createClient()` **tidak** dibungkus `React.cache` → dibangun
  4× per request `/parent`, masing-masing `await cookies()` + `getPublicEnv()` (yang
  menjalankan Zod `safeParse` setiap kali, `lib/env.ts:12-26`).

### F7 — Tab ortu yang masih server-heavy (melanggar konvensi sendiri)

Konvensi bilang `page.tsx` tab = auth saja. Empat tab utama (`tasks`, `targets`, `savings`,
`queue`) **sudah patuh**. Yang belum:

- **`/parent/profil-anak`** — tujuan bottom nav (`parent-bottom-nav.tsx:15`) tapi di-fetch
  penuh di server (`app/parent/profil-anak/page.tsx:39-47`): tidak ada hook React Query,
  tidak ada entri di `parentQueryKeys`, dan `prefetchParentTabData`
  (`lib/parent/prefetch-parent-queries.ts:91-103`) tidak punya cabang untuk rute ini. Setiap
  tap = RSC round-trip penuh + 5 query, nol reuse cache.
- **`/parent/ledger`** (`app/parent/ledger/page.tsx:31,33`) — 2 await berurutan di dalam
  Suspense; total 4 hop termasuk join `task_history→tasks` 150 baris.
- **`/parent/incidental`** (`app/parent/incidental/page.tsx:19,22-26`) — komponen rute `async`
  **tanpa Suspense sama sekali**, jadi tidak ada yang streaming: 4 hop berurutan sebelum
  first byte.

### F8 — Service worker menyajikan HTML terautentikasi yang basi

`public/sw.js:99-123` (`staleWhileRevalidateNavigate`) menyimpan **setiap** respons navigasi
dokumen yang sukses ke `CACHE_NAME`, lalu mengembalikan salinan cache lebih dulu pada
navigasi keras berikutnya. Itu halaman personal terautentikasi (`/parent`, `/parent/savings`, …).

Komentar di `sw.js:4` justru menyatakan "jangan pre-cache route HTML" — tapi handler runtime
di `:106` memasukkannya kembali. Ini lebih ke **risiko kebenaran** daripada kecepatan:
setelah sign-out, navigasi keras ke `/parent` bisa menyajikan HTML sesi sebelumnya dari Cache
Storage; hal yang sama berlaku antar profil anak di perangkat bersama. Jalur ini benar-benar
kena lewat `navigateToParentDashboardAfterChildExit()` (`lib/stores/child-mode-store.ts:243`,
`window.location.assign` = navigasi keras).

Bagian yang **sudah benar** dan tidak perlu diutak-atik: bypass RSC di `sw.js:59-71`
(`RSC: 1`, `Next-Router-Prefetch`, `Next-Router-State-Tree`, `/_next`, `/api/`, non-GET,
Supabase REST/RPC) lengkap dan tepat — SW praktis tidak menambah latensi ke navigasi klien.

Masalah kedua: `isSupabaseStorageGet` (`sw.js:52-57`) mencakup URL bertanda tangan yang
tokennya berotasi tiap jam (`SIGNED_URL_TTL_SEC = 3600`, `lib/query/constants.ts:31`). Cache
key ikut berubah tiap jam → **dijamin cache miss tiap jam** + entri cache menumpuk tanpa
pernah dibersihkan (hanya bump `CACHE_NAME` yang membersihkan).

### F9 — Badai invalidasi realtime + channel yang re-join tiap render

Pada **satu** event `task_history`:
- `lib/hooks/use-family-realtime.ts:48` → invalidate `["task-history", profileId]`
- `:49` → invalidate `parentQueryKeys.all` = **`["parent"]`** (prefix match → semua query ortu)
- `:50` → `onFamilyDataChange?.()` → `components/parent/parent-home-realtime.tsx:23` →
  invalidate **`["parent"]` lagi**

Prefix yang sama diinvalidasi **dua kali per event**. Karena `ParentTabPrefetch` sudah
menghangatkan tasks/targets/savings ke cache di setiap page load ortu, satu anak yang
menyelesaikan 5 misi = 10 invalidasi seluruh subtree `["parent"]`, dan savings adalah
fetcher terberat (8 query, 3 gelombang — `lib/parent/fetch-family-page-data-client.ts:149-219`
+ `lib/savings/enrich-pockets.ts:68`).

Ditambah: deps efek di `:89` memuat `childProfileIds` (identitas array baru tiap render;
props server di `app/parent/page.tsx:31`) dan `onFamilyDataChange` (arrow inline yang dibuat
ulang tiap render di `parent-home-realtime.tsx:22-24`). Jadi setiap re-render
`ParentHomeRealtime` **memutus WebSocket dan join ulang** dengan 7 binding
`postgres_changes` baru. Nama channel juga hardcoded `"family-realtime"`
(`use-family-realtime.ts:36`) → dua channel bertopik sama saat transisi rute.

### F10 — Submit/setujui: area ini sebagian besar sudah sehat

Hanya ada 3 `router.refresh()` se-repo, dan 2 di antaranya benar:
- `components/providers/supabase-auth-listener.tsx:22` — hanya `SIGNED_IN`/`SIGNED_OUT`,
  `TOKEN_REFRESHED` sengaja dikecualikan. Ini justru sumber refresh-storm klasik dan sudah
  ditangani dengan benar.
- `components/parent/family-shared-goal-hero.tsx:106` — jalur error, wajar.
- `components/parent/family-shared-goal-hero.tsx:96` — **redundan**: action sudah memanggil
  `revalidatePath("/parent")` + `revalidatePath("/child/home")`
  (`app/parent/actions/shared-family-goal.ts:99-100`), jadi ini memicu render dasbor penuh
  yang **kedua** per penyimpanan.

Jadi rasa "freeze" saat approve kemungkinan besar datang dari **F9** (invalidasi ganda →
refetch savings 8 query) dan dari `revalidatePath` yang ditembakkan ke 5 rute sekaligus
(`app/child/savings/actions.ts:62-66` dan `:108-112`), bukan dari `router.refresh()`.

### F11 — Higiene DB: belum terasa sekarang, akan terasa nanti

Dari Supabase performance advisors:
- **26 foreign key tanpa index penutup** — a.l. `point_ledger_account_id_fkey`,
  `savings_transactions_ledger_id_fkey`, `task_history_approved_by_account_id_fkey`,
  3 FK di `gold_transactions`, 3 di `goal_hp_transfers`
- **17 policy RLS mengevaluasi ulang `auth.<fn>()` per baris** — `savings_transactions`,
  `gold_transactions`, `family_settings`, `daily_check_ins`, `learning_tips` (4 policy), dll.
  Perbaikannya membungkus jadi `(select auth.uid())`.
- 2 index tidak pernah terpakai (`child_profiles_featured_task_id_idx`,
  `account_push_tokens_updated_idx`)

Pada <2.000 baris ini tidak terlihat. Layak dicatat sebagai utang, bukan penyebab keluhan
sekarang.

### F12 — Bundle & provider: kecil-kecil tapi di jalur kritis semua halaman

- `components/shared/pwa-provider.tsx:4` mengimpor `toast` dari `sonner` **secara statis**,
  dan `PwaProvider` berada **di atas** `AppProviders` di `app/layout.tsx:63`. Sonner satu
  modul — jadi seluruh paket masuk chunk root, yang membuat `dynamic()` Toaster di
  `lib/providers/app-providers.tsx:9-12` **sia-sia**: bayar byte-nya *dan* bayar request
  chunk tambahan.
- `PwaInstallPrompt` (153 LOC) diimpor statis di `pwa-provider.tsx:5` → masuk bundle awal
  **setiap** rute termasuk `/login` dan `/offline`, padahal hampir selalu me-render `null`
  (`pwa-install-prompt.tsx:78`).
- `pwa-provider.tsx:73-75` — listener `visibilitychange` **tidak pernah dilepas**; cleanup
  di `:83-87` hanya melepas `pagehide`, `load`, dan `focus`.
- `lib/parent/prefetch-parent-queries.ts:78,81` — dua `setTimeout` (350 ms & 900 ms) tanpa
  handle dan tanpa clear; pindah halaman di tengah jendela itu tetap menembakkan fetcher
  savings yang terberat.
- `components/parent/invite-creator.tsx:42` — `setTimeout` 2000 ms tanpa cleanup.
- Signed URL avatar: N panggilan `createSignedUrl` terpisah
  (`lib/storage/signed-url-cache.ts:54-58`) padahal Supabase punya `createSignedUrls` (batch).
  Hasil gagal tidak pernah di-cache (`:28-31`) → remount selalu request ulang. `ChildAvatar`
  memakai `<img>` mentah (`child-avatar.tsx:109-116`) sehingga foto asli ukuran penuh diunduh
  lalu dirender ke kotak `h-6 w-6` (`parent-ledger-view.tsx:80`) — padahal `next.config.ts:23-25`
  sudah meng-allowlist endpoint transform Supabase yang tidak pernah dipakai.

**Yang sudah benar dan sebaiknya tidak diubah:** semua view ortu >500 baris sudah lewat
`parent-dynamic-views.tsx`; keempat query key prefetch↔hook ortu **cocok persis**; ketujuh
query key anak juga cocok persis; `app/parent/layout.tsx` sudah sync; registrasi SW sudah
ditunda via `requestIdleCallback`; tidak ada `setInterval`/`refetchInterval` di mana pun.

---

## Kode mati yang ditemukan (bukan isu performa, tapi menambah permukaan)

- `app/child/savings/get-child-savings.ts` — server action **tanpa satu pun pemanggil**,
  tapi tetap menerbitkan endpoint server action
- `lib/child/child-page-prefetch.tsx:9-16` — wrapper no-op yang mengembalikan `children` dan
  mengabaikan prop `tab`; dipakai di 6 halaman anak
- `lib/parent/seed-parent-list-cache.ts:21` — `readParentListCache` diekspor, tidak pernah dipanggil
- `lib/parent/prefetch-parent-queries.ts:63` — menulis cache key `"stale-entry"` yang tidak
  pernah dibaca siapa pun (`parent-savings-view` tidak memakai `useParentListCache`)
- `childQueryKeys.points` — ditulis (`use-child-home-data.ts:33`) dan diinvalidasi (`:42`),
  tapi **tidak ada `useQuery` yang membacanya**
- `lib/gold/fetch-gold.ts:283` — mengembalikan `pnl: emptyChildPnl(...)` placeholder yang
  tidak dipakai, karena panel selalu refetch P&L sungguhan
- `app/parent/settings/page.tsx:6` — impor `createClient` tidak terpakai
- 17 file `.tmp-*.sql` / `.tmp-*.json` / `.tmp-*.b64` di root repo

---

## Urutan eksekusi yang disarankan (untuk ronde berikutnya)

Diurutkan berdasarkan (dampak ÷ risiko):

| # | Perubahan | Menyentuh | Risiko |
|---|-----------|-----------|--------|
| 1 | `"regions": ["sin1"]` di `vercel.json` | 1 baris | sangat rendah |
| 2 | `prefetch={true}` → default di 2 bottom nav | 2 baris | rendah |
| 3 | Pindahkan cek path ke atas `getUser()`; persempit matcher | `middleware.ts`, `lib/supabase/middleware.ts` | rendah |
| 4 | `getUser()` → `getClaims()` di middleware (ES256 sudah aktif) | `lib/supabase/middleware.ts` | sedang — perlu uji alur login/logout |
| 5 | Beri `ChildModeGuard` nilai awal dari cookie server, hapus gate skeleton | `app/child/layout.tsx`, `child-mode-guard.tsx`, `child-mode-store.ts` | sedang — inti sesi anak |
| 6 | `child-dynamic-views.tsx` meniru `parent-dynamic-views.tsx` | 7 halaman anak | rendah |
| 7 | `LazyMotion`+`m`, atau ganti preset fade-up dengan CSS | 17 file framer-motion | rendah, repetitif |
| 8 | Hapus invalidasi `["parent"]` ganda; stabilkan deps realtime | `use-family-realtime.ts`, `parent-home-realtime.tsx` | rendah |
| 9 | Berhenti cache HTML navigasi terautentikasi di SW (+ bump `CACHE_NAME`) | `public/sw.js` | rendah, **wajib bump versi** |
| 10 | `/parent/profil-anak` → pola client-first + React Query | 1 rute + hook baru | sedang |
| 11 | Hilangkan query `child_profiles` duplikat (oper `parentStickyMessage`) | `fetch-child-data.ts:169` | rendah |
| 12 | Bungkus `createClient` dengan `React.cache`; memoize `getPublicEnv` | `lib/supabase/server.ts`, `lib/env.ts` | rendah |
| 13 | Higiene DB: index FK + `(select auth.uid())` di RLS | migrasi baru | rendah, belum mendesak |

Butir 1–4 kemungkinan besar memberi perbaikan paling terasa per baris kode yang diubah.
Butir 5+6+7 adalah yang benar-benar memperbaiki cold start di sisi anak.

---

## Verifikasi (ukur dulu, jangan percaya estimasi di atas)

Angka latensi di F5 adalah estimasi tipikal, bukan pengukuran. Sebelum mengubah apa pun,
ambil baseline:

1. **Region fungsi yang sebenarnya** — `curl -sI https://<domain>/parent | grep -i x-vercel-id`.
   Header itu menyebut region yang melayani (mis. `hnd1::...`). Ulangi setelah menyetel `sin1`.
2. **TTFB per rute** — DevTools → Network → klik dokumen HTML → catat *Waiting (TTFB)* untuk
   `/parent`, `/parent/tasks`, `/parent/profil-anak`, `/child/home`.
3. **Jumlah request Supabase per navigasi** — Network, filter `supabase.co`. Target ada di
   `docs/performance-verification.md` §1.
4. **Jumlah prefetch RSC** — Network, filter `_rsc`. Sekarang harusnya ~5 per page load;
   setelah butir 2 harusnya turun drastis.
5. **Cold start sisi anak** — Performance panel, throttle *4x CPU slowdown* + *Fast 3G*,
   rekam `/child/home` dari kosong. Catat jarak antara *first paint* (skeleton) dan
   *skeleton hilang* — itulah biaya F1+F2.
6. **Ukuran First Load JS** — `pnpm build`, bandingkan kolom *First Load JS* untuk rute
   `/child/*` sebelum vs sesudah.
7. `pnpm build` dan `pnpm lint` harus tetap lulus (catatan: ESLint sudah melaporkan banyak
   isu lama yang bukan berasal dari perubahan ini — lihat `AGENTS.md`).

Setelah setiap perubahan SW, **uninstall + reinstall PWA** dan bump `CACHE_NAME`
(`public/sw.js:1`, sekarang `habiku-pwa-cache-v7`).
