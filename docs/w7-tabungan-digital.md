# W7 — Tabungan Digital (Kantong)

**Prioritas produk berikutnya** (setelah W4–W5 engagement). Paritas konsep **Kantong** dari PRD React Native §11 — tabungan terpisah dari energi target hadiah.

**Status:** ⬜ belum diimplementasi (belum ada migrasi / UI di repo ini).

**Auth web:** hanya email/password — **tanpa** Google OAuth.

---

## Tujuan produk

Anak mengalokasikan sebagian **energi/poin** ke “kantong” tabungan untuk hadiah jangka panjang; orang tua mengawasi, menetapkan aturan, dan menyetujui penarikan. Membangun kebiasaan menunda gratifikasi tanpa mengganggu alur target aktif (`goals` + `goal_funding`).

---

## Prinsip desain

1. **Satu sumber kebenaran saldo:** turunan dari `point_ledger` (append-only), sama pola audit dengan ledger utama.
2. **Pemisahan jelas:** energi ke target hadiah vs energi ke tabungan — UI dan tipe ledger harus dapat dibedakan ortu/anak.
3. **Idempotensi:** setor/tarik hanya lewat RPC `SECURITY DEFINER` (bukan INSERT ledger dari klien).
4. **Toggle keluarga:** hormati `family_settings` (nonaktifkan UI tanpa menghapus data).

---

## Fase implementasi

### Fase A — Skema & RPC (backend)

| Task | Keterangan |
|------|------------|
| Tabel `savings_pockets` | Per anak: nama, ikon/warna, target nominal (opsional), `is_active` |
| Tabel `savings_transactions` | Log setor/tarik/transfer antar kantong; FK ke `point_ledger` bila memindahkan energi |
| Enum `ledger_type` | Tambah nilai mis. `savings_deposit`, `savings_withdraw` (atau pakai `spend` + metadata) |
| RPC `deposit_to_savings` | Kurangi saldo “tersedia” / alokasi ke kantong; validasi cukup energi |
| RPC `request_savings_withdraw` | Anak/ortu ajukan penaruh; status pending |
| RPC `approve_savings_withdraw` | Ortu setuju → ledger + notifikasi anak |
| RLS | SELECT keluarga; mutasi hanya RPC |
| Realtime | Publication untuk kantong & saldo agregat |

### Fase B — UI orang tua

| Task | Keterangan |
|------|------------|
| `/parent/savings` atau tab di profil anak | Daftar kantong per anak, saldo, riwayat |
| Buat/edit kantong | Nama, target, batas maks setor per hari (opsional) |
| Setujui penarikan | Antrean mirip `/parent/queue` (ringan) |
| Link dari beranda | Kartu ringkasan “Tabungan” |

### Fase C — UI anak

| Task | Keterangan |
|------|------------|
| `/child/savings` | Daftar kantong + progress bar ke target |
| Setor energi | Slider / preset dari saldo tersedia |
| Ajukan belanja | Form + status pending |
| Animasi ringan | Framer Motion saat setor berhasil (selaras engagement W5) |

### Fase D — Notifikasi & hardening

| Task | Keterangan |
|------|------------|
| In-app `notifications` | `savings_deposit`, `savings_withdraw_approved`, dll. |
| Web Push (opsional) | Setelah env VAPID diisi |
| e2e Playwright | Setor → approve tarik → saldo konsisten |

---

## Dependensi

- **W1** ledger & `point_ledger` ✅  
- **W5** engagement (opsional untuk sticky/celebration) ✅  
- **W6** notifikasi in-app + re-auth ortu — 🔄 direncanakan sebelum atau paralel Fase D  
- **Env production** — [deployment-env-checklist.md](./deployment-env-checklist.md) (ditunda)

---

## Definition of Done (W7)

Ortu membuat kantong → anak setor energi dari misi yang disetujui → saldo kantong terlihat realtime → anak ajukan penarikan → ortu approve → ledger audit konsisten di `/parent/ledger`.

---

## Setelah W7 (backlog P1)

Weekly Boss → Skill Tree → Mystery reward → Recovery streak → Co-op keluarga (urutan disarankan sama PRD §3 P1).

---

**Terakhir diperbarui:** 2026-06-03
