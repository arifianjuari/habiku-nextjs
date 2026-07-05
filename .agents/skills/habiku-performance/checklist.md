# Checklist Performa Habiku

Gunakan sebelum merge fitur yang menyentuh routing, data, atau PWA.

## Route / tab baru (parent atau child)

- [ ] Server `page.tsx` hanya auth + ID (`familyId` / `profileId`), bukan fetch data berat
- [ ] Data di-fetch client via `useQuery` dengan `staleTime: PARENT_STALE_MS` / `CHILD_STALE_MS`
- [ ] Query key diekspor (`*PageQueryKey`) dan dipakai identik di prefetch + hook
- [ ] Prefetch ditambahkan ke `prefetchParentTabData` / `prefetchChildTabData` + idle prefetch layout
- [ ] View client besar (>500 baris) di-dynamic import
- [ ] `loading.tsx` atau skeleton client untuk first paint

## Server / database

- [ ] `getFamilyChildren` dipakai ulang, tidak query `child_profiles` duplikat dalam satu request
- [ ] Query independen pakai `Promise.all`, bukan sequential
- [ ] `React.cache` untuk data yang dipanggil berkali-kali per request
- [ ] Tidak ada waterfall: auth → children → data jika children bisa di-cache/deduplikasi

## Server actions / submit

- [ ] `revalidatePath` minimal (1–2 path, bukan seluruh `/parent/*`)
- [ ] Tidak ada `router.refresh()` setelah sukses
- [ ] Error path: rollback state lokal, bukan full refresh
- [ ] Optimistic UI untuk approve/reject jika memungkinkan

## PWA

- [ ] Tidak menambah route HTML ke `PRE_CACHE_RESOURCES` di `public/sw.js`
- [ ] Bump `CACHE_NAME` jika mengubah strategi cache
- [ ] SW registration tetap deferred (idle), bukan blocking di load

## Realtime

- [ ] Invalidate React Query (`parentQueryKeys.all`), bukan `router.refresh()`
- [ ] Listener O(N) per anak — pertimbangkan dampak keluarga besar

## Verifikasi

- [ ] `pnpm build` sukses
- [ ] Navigasi tab parent setelah prefetch: tidak skeleton panjang
- [ ] Network: filter `supabase.co` — tidak spike query duplikat
- [ ] (PWA) reinstall / hard refresh setelah ubah SW
