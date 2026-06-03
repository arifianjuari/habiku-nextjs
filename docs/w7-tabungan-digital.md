# W7 — Tabungan digital (Kantong)

Fitur tabungan energi per anak: dompet → kantong → penarikan dengan persetujuan ortu.

## Rute

| Peran | Path | Keterangan |
|-------|------|------------|
| Ortu | `/parent/savings` | Buat kantong, lihat saldo, setujui/tolak penarikan |
| Anak | `/child/savings` | Nabung dari dompet, ajukan penarikan |

## Skema (migrasi `20260621120000_w7_savings_pockets.sql`)

- `savings_pockets` — kantong per `child_profiles`
- `savings_transactions` — setor langsung; tarik `pending` → `approved` / `rejected`
- `family_settings.savings_enabled` — matikan UI tabungan keluarga
- Ledger: `savings_deposit` (negatif dompet), `savings_withdraw` (positif dompet saat disetujui)

## RPC

| RPC | Pemanggil |
|-----|-----------|
| `create_savings_pocket` | Ortu |
| `deposit_to_savings` | Anggota keluarga terautentikasi (mode anak via sesi ortu) |
| `request_savings_withdraw` | Sama |
| `approve_savings_withdraw` / `reject_savings_withdraw` | Ortu |

## Notifikasi in-app

Tipe: `savings_deposit`, `savings_withdraw_pending`, `savings_withdraw_approved`, `savings_withdraw_rejected` (insert di RPC).

UI bell (W6) dapat menampilkan tipe ini pada fase berikutnya.

## Deploy database

Setelah merge, terapkan migrasi ke proyek Supabase `habiku`:

```bash
supabase link --project-ref ohnmeatnujnxeeeaaywv
supabase db push
```

Atau lewat dashboard SQL / MCP `apply_migration` dengan nama `w7_savings_pockets`.

## Env production

Lihat [`deployment-env-checklist.md`](./deployment-env-checklist.md) — `CRON_SECRET`, VAPID, dll. **ditunda** sampai siap; tabungan tidak bergantung env tambahan.
