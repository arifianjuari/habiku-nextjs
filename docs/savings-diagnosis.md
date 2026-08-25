# Diagnosis Fitur Tabungan — Integritas Akuntansi Energi

> Tanggal audit: 25 Agustus 2026 · Cakupan: audit baca-saja terhadap kode + data produksi. Tanpa perubahan kode dan tanpa perubahan data.

## Latar belakang

Fitur tabungan Habiku menerapkan prinsip produk keuangan nyata: **tabungan** (kantong
`flexible`), **deposito** (kantong `term` dengan kunci + bunga), dan **jual-beli emas**
(spread harga beli/jual). Karena itu audit ini memakai lensa integritas akuntansi, bukan
performa: apakah energi kekal, apakah bunga benar, apakah ada jalur yang menciptakan atau
memusnahkan energi.

**Kesimpulan singkat: ya, ada yang salah, dan sudah terjadi di data produksi.**

---

## Temuan inti: ada dua buku besar untuk uang yang sama

Sistem menyimpan energi anak di **dua tempat yang dihitung terpisah**:

| Representasi | Sumber | Dipakai untuk |
|---|---|---|
| **Dompet** | `sum(point_ledger.amount)` via `compute_wallet_balance` | Ditampilkan sebagai saldo dompet |
| **Energi terpakai** | `sum(goals.current_hp)` untuk goal `active` via `compute_savable_goal_energy` | Gerbang untuk menabung, beli emas |

Keduanya seharusnya bergerak bersamaan. Tidak ada constraint, trigger, atau invarian yang
memaksanya. Dari sembilan jalur mutasi, **empat hanya memperbarui satu sisi**:

| Jalur RPC | Dompet (`point_ledger`) | HP goal | Status |
|---|---|---|---|
| `deposit_to_savings` | −amount | −amount | ✅ seimbang |
| `approve_gold_transaction` (beli) | −energy | −energy | ✅ seimbang |
| `approve_savings_withdraw` | +amount | +amount *jika ada goal aktif* | ⚠️ bocor |
| `save_goal_hp_to_savings` | **tidak ada** | → 0 | ❌ timpang |
| `approve_goal_reward_redeem` | **tidak ada** | → 0 | ❌ timpang |
| `approve_gold_transaction` (jual) | +energy | **tidak ada** | ❌ timpang |
| `accrue_savings_interest` | +interest | tidak ada | ❌ ganda (lihat T5) |

### Drift yang sudah terukur di produksi

```sql
select c.name,
       compute_wallet_balance(c.id)      as dompet,
       compute_savable_goal_energy(c.id) as bisa_dipakai,
       compute_wallet_balance(c.id) - compute_savable_goal_energy(c.id) as selisih
from child_profiles c where c.archived_at is null;
```

| Anak | Dompet | Bisa dipakai | **Selisih** | Total kantong |
|---|---:|---:|---:|---:|
| Arvin Aryadinata | 1.748 | 275 | **1.473** | 1.277 |
| Evan Arsadinata | 888 | 45 | **843** | 1.240 |

Anak melihat saldo dompet 1.748, tetapi hanya bisa benar-benar memakai 275. Inilah "ada
yang salah" yang Anda rasakan — angkanya tidak salah ketik, memang dua sistem yang berbeda.

Sumber yang bisa diatribusikan langsung:

- **878** energi pada Arvin dari deposit tanpa baris ledger (`ledger_id is null`)
- **375** energi pada Evan dari satu transaksi jual emas
- **1.388** HP total pada 8 goal berstatus `completed` yang tidak pernah didebit dari dompet

---

## Temuan, diurutkan menurut keparahan

### T1 — `approve_goal_reward_redeem` tidak pernah menulis ledger 🔴

`docs/w8-tabungan-v2-bunga-kunci.md` mendaftarkan `ledger_type: goal_redeem_spend`. Enum-nya
ada di database. **Baris dengan tipe itu berjumlah nol sepanjang sejarah.**

Fungsinya hanya:

```sql
update public.goal_claim_requests set status = 'approved', ... ;
update public.goals set current_hp = 0, status = 'completed', ... ;
-- tidak ada insert ke point_ledger
```

Anak menukarkan hadiah, HP goal jadi 0, tetapi dompet tidak pernah berkurang. Delapan goal
sudah `completed` mencakup 1.388 HP. Ini penyumbang drift terbesar.

### T2 — `save_goal_hp_to_savings` menabung tanpa mendebit dompet 🔴

```sql
insert into public.savings_transactions (..., 'deposit', v_amount, ..., ledger_id)
values (..., null);                       -- ledger_id sengaja null
update public.goals set current_hp = 0, status = 'completed' ...;
```

Bandingkan dengan `deposit_to_savings` yang menulis `point_ledger −amount`. Dua jalur untuk
tindakan ekonomi yang sama menghasilkan saldo dompet yang berbeda.

Lebih jauh: energi ini kemudian **bisa dicetak**. Tabung dari target (dompet tidak
berkurang) → ajukan penarikan → ortu setujui → `approve_savings_withdraw` menulis
`point_ledger +amount`. Dompet bertambah sejumlah yang tidak pernah didebit. Round trip ini
menciptakan energi dari nol.

Terlihat di data: pocket `7e46ed20` punya deposit 170 tanpa ledger (29 Juli) dan penarikan
170 dengan ledger `+170` (29 Juni). Total deposit tanpa ledger pada Arvin: **878**.

### T3 — Jual emas tidak mengembalikan HP ke goal 🔴

Di `approve_gold_transaction`, cabang `buy` dan `sell` tidak simetris:

```sql
-- BELI: mendebit keduanya
insert into point_ledger (... -v_tx.energy_amount, 'gold_buy' ...);
for g in select * from goals where status='active' and current_hp > 0 loop
  update goals set current_hp = current_hp - v_take ...;   -- HP ikut turun
end loop;

-- JUAL: hanya mengkredit dompet
insert into point_ledger (... v_tx.energy_amount, 'gold_sell' ...);
-- tidak ada update goals sama sekali
```

Beli mengurangi dompet **dan** HP; jual hanya menambah dompet. Setiap siklus beli→jual
memusnahkan HP terpakai sebesar nilai transaksi secara permanen. Karena `request_gold_buy`
dan `deposit_to_savings` sama-sama bergerbang pada `compute_savable_goal_energy`, anak
perlahan kehilangan kemampuan bertransaksi meskipun dompetnya terlihat besar.

Terukur pada Evan: **375** energi.

### T4 — Bunga dikreditkan dua kali 🔴 (belum meledak)

Di `accrue_savings_interest`, kedua baris bertanda **positif**:

```sql
insert into public.point_ledger (..., v_interest, 'savings_interest', ...)   -- dompet +I
  returning id into v_ledger_id;
insert into public.savings_transactions (..., 'interest', v_interest, v_ledger_id, ...); -- kantong +I
```

Bandingkan pola setoran yang benar: ledger **−X** / kantong **+X** (pemindahan). Untuk
bunga: ledger **+I** / kantong **+I** — energi bertambah di dua tempat sekaligus. Total
energi anak naik **2× bunga** setiap akrual.

Saat ini belum berdampak karena bunga belum pernah berjalan (lihat T5), tetapi bug ini
sudah terpasang dan akan aktif pada akrual pertama.

**Catatan untuk perbaikan:** constraint `savings_transactions_check` mensyaratkan
`kind='interest'` harus punya `ledger_id IS NOT NULL`. Jadi memperbaikinya bukan sekadar
menghapus insert ledger — perlu baris ledger penyeimbang (`+I` lalu `−I`), atau constraint-nya
yang direvisi.

### T5 — Bunga tidak pernah dijadwalkan 🟠

`vercel.json` hanya memuat satu cron (kondisi per commit `9ec598a`, setelah `regions`
ditambahkan):

```json
{
  "regions": ["sin1"],
  "crons": [
    { "path": "/api/cron/mark-missed-tick", "schedule": "0 * * * *" }
  ]
}
```

Route `/api/cron/accrue-savings-interest` ada, tetapi **tidak ada jadwal yang memanggilnya**.
Terkonfirmasi di data: `point_ledger` bertipe `savings_interest` = **0 baris**,
`savings_transactions` dengan `kind='interest'` = **0 baris**, sejak fitur rilis Juni.

Artinya deposito — fitur utama W8b — tidak pernah membayar bunga sepeser pun di produksi.
Anak yang mengunci energi 6 bulan menerima persis jumlah yang ia setorkan.

### T6 — Periode akrual yang terlewat hilang permanen 🟠

Penjaga idempotensi di `accrue_savings_interest`:

```sql
and (t.last_interest_at is null or t.last_interest_at < date_trunc('month', now()))
```

Penjaga ini benar untuk mencegah akrual ganda dalam satu bulan. Tetapi ia membayar **tepat
satu bulan**, berapa pun bulan yang terlewat. Jika cron mati tiga bulan, dua bulan bunga
hilang tanpa jejak dan tanpa cara memulihkan.

Untuk produk deposito berjangka tetap, ini berarti kontrak 6 bulan bisa jatuh tempo dengan
bunga kurang dari 6 bulan. Formula seharusnya menghitung jumlah periode yang berlalu sejak
`last_interest_at`, bukan sekadar "sudah bulan baru atau belum".

### T7 — Penarikan disetujui bisa membuang energi diam-diam 🟠

```sql
v_remaining := v_tx.amount;
for g in select * from goals where profile_id = ... and status = 'active'
         order by created_at desc
loop
  exit when v_remaining <= 0;
  update goals set current_hp = current_hp + v_remaining ...;
  v_remaining := 0;
end loop;
-- tidak ada pemeriksaan v_remaining setelah loop
```

Tiga masalah dalam satu blok:

1. **Kalau anak tidak punya goal aktif**, badan loop tidak pernah jalan, `v_remaining` tetap
   penuh, dan fungsi **tidak protes**. Kantong tetap didebit, ledger tetap dikredit, tetapi
   HP tidak pernah diterima. Bandingkan `deposit_to_savings` yang eksplisit
   `raise exception 'insufficient_goal_energy'` bila `v_remaining > 0` — asimetris.
2. **Seluruh jumlah masuk ke satu goal** tanpa batas `target_hp`. Goal bisa melampaui
   targetnya diam-diam dan tidak pernah berubah jadi `ready_to_claim`, karena
   `resolve_goal_status_on_hp_reached` tidak dipanggil di sini.
3. **Loop-nya dekoratif** — `v_remaining := 0` di iterasi pertama, jadi ia tidak pernah
   mendistribusikan ke goal kedua meskipun ditulis seolah-olah begitu.

### T8 — HP terdampar di goal yang sudah selesai 🟡

Tiga goal milik Arvin berstatus `completed` tetapi masih memegang HP:

| Goal | Status | `current_hp` | `target_hp` |
|---|---|---:|---:|
| Robux | completed | 180 | 180 |
| Parfum | completed | 130 | 130 |
| 200 points | completed | 200 | 200 |

Total **510** energi. `compute_savable_goal_energy` hanya menjumlah goal `active`, jadi
energi ini tidak bisa ditabung, tidak bisa dibelikan emas, tidak bisa ditarik — tetapi masih
terhitung di dompet. Peninggalan jalur penyelesaian goal versi lama yang tidak menormalkan
`current_hp` ke 0.

### T9 — Deposito tidak bisa diperpanjang 🟡

```sql
create function term_pocket_has_deposit(p_pocket_id uuid) returns boolean as $$
  select exists (select 1 from savings_transactions t join savings_pockets p ...
                 where t.pocket_id = p_pocket_id and p.pocket_type='term'
                   and t.kind='deposit');   -- deposit APA PUN, sepanjang sejarah
$$;
```

Baik `deposit_to_savings` maupun `save_goal_hp_to_savings` menolak setoran bila fungsi ini
true. Karena ia memeriksa deposit apa pun yang pernah ada — bukan yang masih aktif — sebuah
kantong deposito yang **sudah jatuh tempo dan sudah ditarik habis menjadi mati permanen**.
Anak harus membuat kantong baru setiap kali; tidak ada roll-over, padahal itu justru
perilaku deposito yang ingin diajarkan.

### T10 — Proyeksi bunga di UI tidak cocok dengan mesin akrual 🟡

`lib/savings/interest.ts:17-24`:

```typescript
export function projectedInterestTotal(principal, pocket) {
  const monthly = monthlyInterestAmount(principal, effectiveMonthlyBps(pocket));
  const months = pocket.pocket_type === "term" ? (pocket.lock_months ?? 0) : 0;
  return monthly * months;                       // flexible → selalu 0
}
```

Dua ketidakcocokan dengan `accrue_savings_interest`:

- **Kantong `flexible` ditampilkan proyeksi 0**, padahal mesin akrual jelas membayar bunga
  untuk `flexible` (`v_pocket.pocket_type = 'flexible' or (locked_until > now())`). Anak
  diberi tahu tabungannya tidak berbunga, padahal berbunga.
- **Principal berbeda.** `enrich-pockets.ts:87` memakai `balance` (yang setelah akrual sudah
  termasuk bunga), sedangkan mesin akrual memakai `v_deposit.amount` (setoran asli). Begitu
  bunga pertama masuk, angka proyeksi dan angka realisasi langsung berpisah.

### T11 — `pnl.ts` menyembunyikan drift alih-alih melaporkannya 🟡

```typescript
// lib/gold/pnl.ts:74-76
if (holdings !== holdingsMilli && holdings > 0 && holdingsMilli >= 0) {
  costBasis = Math.round((costBasis * holdingsMilli) / holdings);
}
```

Ketika saldo emas hasil replay transaksi berbeda dari `gold_holdings.quantity_milli` yang
tersimpan, kode **menskala ulang cost basis agar cocok** — persis menutupi jenis
inkonsistensi yang dihasilkan T1–T3. Hal serupa di `applyApprovedTx` baris 35-40: menjual
saat `holdings <= 0` menyetel `costBasis = 0` tanpa keluhan. Selisih yang seharusnya jadi
alarm justru dirapikan diam-diam, sehingga P&L terlihat wajar di atas data yang tidak wajar.

### T12 — Harga emas dikunci saat request, tanpa kedaluwarsa 🟡

`request_gold_buy` menghitung dan menyimpan `quantity_milli`, `energy_amount`, dan
`unit_price_energy` pada saat pengajuan. `approve_gold_transaction` memakainya apa adanya.
Tidak ada batas waktu.

Anak bisa mengajukan pembelian, menunggu ortu menaikkan harga emas lewat `update_gold_prices`,
lalu meminta persetujuan — dan menerima emas dengan harga lama. Dalam perdagangan nyata
harga dikunci saat eksekusi, bukan saat order tanpa masa berlaku. Untuk aplikasi yang
mengajarkan pergerakan harga, celah ini mengajarkan hal yang keliru.

### T13 — Harga emas boleh bernilai 0 🟢

`family_settings.gold_sell_price_energy` dan `gold_buy_price_energy` bertipe `integer NOT NULL`
(default 20 dan 18) tetapi **tanpa CHECK `> 0`**. `request_gold_buy` menghitung
`v_qty_milli := (v_energy * 1000) / v_sell_price` — harga 0 memicu division by zero.

### T14 — Plafon bunga hanya ditegakkan di TypeScript 🟢

`MONTHLY_INTEREST_ABS_MAX_BPS = 2000` (20%/bulan) ada di `lib/savings/interest.ts`, dan
`family_settings.max_monthly_interest_bps` default 500. Tetapi constraint database hanya
`monthly_interest_bps >= 0` — tanpa batas atas. Validasi yang hanya hidup di klien bukan
validasi.

Catatan produk: 5%/bulan setara ~80% per tahun, dan plafon 20%/bulan setara ~792% per tahun.
Untuk fitur yang bertujuan mengajarkan intuisi bunga yang benar, angka ini jauh di atas
tabungan atau deposito nyata mana pun. Ini keputusan desain Anda, bukan bug — hanya perlu
disadari bahwa intuisi yang terbentuk akan meleset.

---

## Yang sudah benar dan sebaiknya dipertahankan

Bagian-bagian ini justru dikerjakan dengan baik dan tidak perlu diutak-atik:

- **Spread beli/jual emas** (20 vs 18, ~10%) realistis, dan `pnl.ts` menilai kepemilikan
  memakai harga beli-kembali (`energyForSellMilli(holdings, currentBuyPriceEnergy)`) — mark
  to bid, sesuai praktik nyata.
- **Reservasi emas untuk penjualan pending** benar: `compute_gold_available_milli` =
  saldo − pending sell, sehingga tidak bisa menjual emas yang sama dua kali.
- **`approve_gold_transaction` mengecualikan transaksi berjalan** dari perhitungan pending
  buy (`compute_gold_pending_buy_energy(...) - v_tx.energy_amount`) — detail halus yang
  sering salah, di sini benar.
- **`request_savings_withdraw` memeriksa `balance − reserved`**, bukan balance saja, sehingga
  dua penarikan pending tidak bisa melebihi saldo.
- **`FOR UPDATE`** dipakai pada baris transaksi di semua RPC approve/reject.
- **Constraint non-negatif** (`goals_current_hp_check`, `gold_holdings_quantity_milli_nonneg`,
  `savings_transactions_amount_check`) mencegah saldo negatif diam-diam — race condition
  akan gagal keras, bukan merusak data.
- **Penjaga idempotensi bulanan** pada akrual bunga sudah ada dan benar per setoran.

---

## Urutan perbaikan yang disarankan

Diurutkan menurut (dampak ÷ risiko). Butir 1 harus lebih dulu — sisanya sulit diverifikasi
tanpa alat ukurnya.

| # | Perbaikan | Menyentuh | Risiko |
|---|---|---|---|
| 1 | Tulis query rekonsiliasi + view `energy_drift` sebagai alat ukur tetap | migrasi baru | sangat rendah |
| 2 | Putuskan invarian resmi: apakah `goals.current_hp` turunan dari ledger, atau buku besar setara | keputusan desain | — |
| 3 | `approve_goal_reward_redeem` menulis `goal_redeem_spend` −HP | 1 RPC | rendah |
| 4 | `save_goal_hp_to_savings` menulis `savings_deposit` −HP | 1 RPC | rendah |
| 5 | `approve_gold_transaction` cabang jual mengembalikan HP ke goal | 1 RPC | rendah |
| 6 | `approve_savings_withdraw`: `raise` bila `v_remaining > 0`; hormati `target_hp` | 1 RPC | sedang |
| 7 | Perbaiki kredit ganda bunga (+ sesuaikan `savings_transactions_check`) | 1 RPC + constraint | sedang |
| 8 | Jadwalkan cron bunga di `vercel.json` — **setelah** butir 7 | 1 baris | rendah |
| 9 | Akrual menghitung periode terlewat, bukan satu bulan tetap | 1 RPC | sedang |
| 10 | Migrasi koreksi untuk drift yang sudah ada (1.473 + 843) | migrasi data | **tinggi — perlu keputusan Anda** |
| 11 | `term_pocket_has_deposit` hanya lihat deposit aktif → deposito bisa roll-over | 1 fungsi | rendah |
| 12 | Samakan proyeksi bunga UI dengan mesin akrual (`flexible` + principal) | `interest.ts`, `enrich-pockets.ts` | rendah |
| 13 | `pnl.ts` melaporkan selisih, bukan menyembunyikannya | `pnl.ts` | rendah |
| 14 | Masa berlaku pengajuan emas + CHECK harga `> 0` + plafon bunga di DB | migrasi + RPC | rendah |

**Butir 10 perlu keputusan Anda, bukan keputusan teknis.** Drift yang ada bisa ditangani
dengan tiga cara: turunkan dompet agar cocok dengan HP (anak "kehilangan" energi yang
terlanjur terlihat), naikkan HP agar cocok dengan dompet (anak diuntungkan), atau bekukan
angka historis dan berlakukan invarian hanya untuk transaksi baru. Ketiganya punya
konsekuensi berbeda bagi anak yang sudah melihat saldonya.

---

## Cara memverifikasi

Sebelum dan sesudah setiap perbaikan, jalankan rekonsiliasi ini:

```sql
-- Drift per anak; target: kolom selisih = 0 untuk semua baris
select c.name,
       compute_wallet_balance(c.id)      as dompet,
       compute_savable_goal_energy(c.id) as bisa_dipakai,
       compute_wallet_balance(c.id) - compute_savable_goal_energy(c.id) as selisih
from child_profiles c
where c.archived_at is null
order by selisih desc;

-- Setoran tanpa pasangan ledger; target: 0 baris
select * from savings_transactions where kind = 'deposit' and ledger_id is null;

-- HP terdampar di goal selesai; target: 0 baris
select id, title, current_hp from goals where status = 'completed' and current_hp > 0;

-- Konservasi bunga; target: kedua kolom sama besar dan berlawanan tanda
select
  (select coalesce(sum(amount),0) from point_ledger where type='savings_interest') as ledger,
  (select coalesce(sum(amount),0) from savings_transactions where kind='interest') as kantong;
```

Uji perilaku yang harus dijalankan manual setelah perbaikan:

1. Tabung dari target → ajukan tarik → setujui. Dompet harus kembali ke angka semula.
2. Beli emas → jual emas. `compute_savable_goal_energy` harus kembali ke angka semula
   dikurangi spread.
3. Setujui penarikan **saat anak tidak punya goal aktif** — harus gagal dengan pesan jelas,
   bukan diam-diam berhasil.
4. Jalankan `accrue_savings_interest()` dua kali berturut-turut dalam bulan yang sama —
   akrual kedua harus mengembalikan 0.
5. Deposito jatuh tempo → tarik habis → setor lagi ke kantong yang sama harus bisa.
