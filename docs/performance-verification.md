# Verifikasi Performa Habiku

Panduan singkat untuk mengukur dampak optimasi performa sebelum dan sesudah perubahan.

## 1. Request Supabase per navigasi

1. Buka Chrome DevTools → **Network**.
2. Filter: `supabase.co`.
3. Hard refresh, lalu navigasi ke route berikut (catat jumlah request):

| Route | Target setelah optimasi |
|-------|-------------------------|
| `/parent/tasks` | ≤4 request DB (1× children + tasks + goals + requests) |
| `/parent/queue` | ≤4 request (1× children + 3 parallel) |
| `/parent/savings` | Sesuai `fetchParentSavingsData` |
| `/child/home` | ≤8 request fase 1 + fase 2 (tanpa duplikasi settings) |

## 2. TTFB dan LCP

1. DevTools → **Network** → klik dokumen HTML route.
2. Catat **Waiting (TTFB)**.
3. DevTools → **Performance** → rekaman navigasi → catat **LCP**.

Route wajib diukur:

- `/parent`
- `/parent/tasks`
- `/parent/queue`
- `/child/home`

## 3. Interaksi submit / setujui

1. DevTools → **Performance** → Start recording.
2. Jalankan aksi:
   - Setujui misi di `/parent/queue`
   - Setujui penarikan di `/parent/savings`
   - Submit misi dengan foto di `/child/missions/[taskId]`
3. Stop recording; periksa durasi **Long Tasks** (>50ms) dan apakah `router.refresh` masih muncul di flame chart.

**Harapan setelah optimasi:**

- Tidak ada `router.refresh()` setelah approve/setujui sukses.
- Error path rollback state lokal tanpa full RSC refresh.

## 4. Skenario idle (10+ menit)

1. Buka `/parent`, biarkan tab idle ≥10 menit.
2. Klik tab **Misi** atau **Antrean**.
3. Catat TTFB navigasi pertama vs navigasi berikutnya.

Perbedaan besar pada navigasi pertama = cold start serverless + middleware auth (wajar di Vercel).

## 5. Lighthouse (opsional)

```bash
pnpm build && pnpm start
```

Jalankan Lighthouse (mobile) pada `/parent` dan `/child/home`. Simpan skor Performance sebelum/sesudah.

## 7. PWA — cek khusus

Setelah update client-first parent tabs:

1. **Uninstall + reinstall PWA** (atau hard refresh) agar service worker v7 aktif — versi lama pre-cache route HTML yang membebani install.
2. Buka `/parent`, tunggu ~2 detik (prefetch idle), lalu klik tab **Misi / Tabungan / Target** — seharusnya **tanpa skeleton panjang** jika cache sudah warm.
3. Di Network, filter `supabase.co` saat pindah tab: request data dari **browser langsung**, bukan menunggu RSC page fetch berat.

**Catatan:** Loading **pertama kali** setelah buka PWA tetap ada overhead middleware auth + hydrate — itu normal. Yang harus membaik adalah **tab switch berikutnya** dan **buka ulang dalam 60 detik** (React Query + router staleTimes).

```bash
pnpm build
pnpm lint
```

Build harus sukses tanpa error TypeScript baru.
