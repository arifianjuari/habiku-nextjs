# W8 — Tabungan v2: Bunga, Kunci & Klaim Target

Perluasan [W7 tabungan digital](./w7-tabungan-digital.md): kantong berbunga, deposito terkunci, dan jembatan **Target Hadiah → tabung/cair**.

## Rute

| Peran | Path | Keterangan |
|-------|------|------------|
| Ortu | `/parent/savings` | Buat kantong v2, antrean cair hadiah + penarikan |
| Anak | `/child/savings` | Lihat kantong, countdown kunci, proyeksi bunga |
| Anak | `/child/targets` | Modal klaim saat `ready_to_claim`: Cair vs Tabung |

## Tipe kantong

| Tipe | Perilaku |
|------|----------|
| `flexible` | Banyak setoran dari dompet atau (via RPC khusus) dari goal; akumulatif |
| `term` | **Satu setoran** per kantong (deposito); energi terkunci hingga `locked_until` |

## Skema (migrasi `20260606120000_w8_savings_v2.sql`)

### Enum & kolom baru

- `goal_status`: nilai `ready_to_claim`
- `savings_pocket_type`: `flexible`, `term`
- `savings_tx_kind`: nilai `interest`
- `ledger_type`: `savings_interest`, `goal_redeem_spend`
- `goal_claim_status`: `pending`, `approved`, `rejected`

### `savings_pockets`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `pocket_type` | enum | Default `flexible` |
| `monthly_interest_bps` | int | Basis poin per 10.000 (500 = 5%/bulan) |
| `lock_months` | int | Durasi kunci untuk `term` |
| `lock_bonus_coefficient` | numeric | Pengali rate efektif (default 1.0) |
| `default_for_goal_save` | boolean | Kantong default saat anak tabung dari target |

Indeks unik parsial: satu `default_for_goal_save = true` per `profile_id`.

### `savings_transactions`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `locked_until` | timestamptz | Akhir masa kunci setoran |
| `interest_accrued` | int | Akumulasi bunga pada baris deposit |
| `principal_snapshot` | int | Principal saat setoran (audit deposito) |
| `last_interest_at` | timestamptz | Akrual terakhir |

### `goal_claim_requests`

| Kolom | Keterangan |
|-------|------------|
| `goal_id`, `profile_id` | FK |
| `status` | `pending` / `approved` / `rejected` |
| `requested_by_account_id` | Anak (via sesi ortu) |
| `reviewed_by_account_id` | Ortu |

### `family_settings`

| Kolom | Default |
|-------|---------|
| `goal_save_enabled` | `true` |
| `savings_interest_enabled` | `true` |
| `max_monthly_interest_bps` | `500` |

## RPC

| RPC | Pemanggil |
|-----|-----------|
| `create_savings_pocket_v2` | Ortu |
| `request_goal_reward_redeem` | Keluarga (mode anak) |
| `approve_goal_reward_redeem` | Ortu |
| `reject_goal_reward_redeem` | Ortu |
| `save_goal_hp_to_savings` | Keluarga (mode anak) |
| `accrue_savings_interest` | Cron (service role) |

### Perilaku `ready_to_claim`

Saat alokasi HP membuat `current_hp >= target_hp`, status goal menjadi **`ready_to_claim`** (bukan langsung `completed`). Anak memilih:
- **Cair** → `goal_claim_requests` pending → ortu approve → `completed`, HP = 0
- **Tabung** → `save_goal_hp_to_savings` → setoran kantong + `completed`, HP = 0

### Bunga

- Job bulanan: `POST /api/cron/accrue-savings-interest` dengan header `Authorization: Bearer $CRON_SECRET`
- Formula: `floor(principal × effective_bps / 10000)` per periode
- `effective_bps = monthly_interest_bps × lock_bonus_coefficient` (kantong `term` terkunci)
- Kantong `flexible`: bunga pada saldo positif jika `savings_interest_enabled`

## Notifikasi

| Tipe | Pemicu |
|------|--------|
| `goal_claim_pending` | Anak ajukan cair hadiah |
| `goal_claim_approved` | Ortu setujui cair |
| `goal_saved_to_pocket` | Anak tabung dari target |
| `savings_interest_posted` | Job akrual bulanan |

## Deploy

```bash
supabase db push
```

Env tambahan: `CRON_SECRET` untuk job bunga (lihat [`deployment-env-checklist.md`](./deployment-env-checklist.md)).

## Definition of Done

**W8a:** kantong v2, klaim target, antrean ortu, tanpa cron.

**W8b:** cron bunga + ledger `savings_interest` + proyeksi di UI anak/ortu.
