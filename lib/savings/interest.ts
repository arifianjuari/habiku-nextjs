import type { SavingsPocketRow } from "@/lib/savings/types";

/** Plafon kolom `monthly_interest_bps` / `max_monthly_interest_bps` (2000 = 20%/bulan). */
export const MONTHLY_INTEREST_ABS_MAX_BPS = 2000;

/** Horizon proyeksi kantong flexible — tidak punya jatuh tempo. */
export const FLEXIBLE_PROJECTION_MONTHS = 12;

/** Basis poin per 10.000 (500 = 5%/bulan). */
export function effectiveMonthlyBps(pocket: Pick<SavingsPocketRow, "monthly_interest_bps" | "lock_bonus_coefficient">): number {
  return Math.floor(pocket.monthly_interest_bps * Number(pocket.lock_bonus_coefficient));
}

export function monthlyInterestAmount(principal: number, effectiveBps: number): number {
  if (principal < 1 || effectiveBps < 1) return 0;
  return Math.floor((principal * effectiveBps) / 10000);
}

/**
 * Perkiraan total bunga ke depan.
 *
 * Cerminan langsung `accrue_savings_interest`: tiap bulan mesin menghitung
 * `floor(saldo_kantong * effective_bps / 10000)` lalu menambahkannya ke saldo —
 * jadi bunganya **majemuk**, dan basisnya saldo kantong berjalan, bukan nominal
 * setoran. Proyeksi ini menjalankan loop yang sama supaya angka di UI dan angka
 * yang benar-benar dibayar tidak berpisah.
 */
export function projectedInterestTotal(
  balance: number,
  pocket: Pick<SavingsPocketRow, "monthly_interest_bps" | "lock_bonus_coefficient" | "lock_months" | "pocket_type">,
  options?: { projectionMonths?: number },
): number {
  const effectiveBps = effectiveMonthlyBps(pocket);
  const months =
    options?.projectionMonths ??
    (pocket.pocket_type === "term"
      ? (pocket.lock_months ?? 0)
      : FLEXIBLE_PROJECTION_MONTHS);

  if (months < 1 || effectiveBps < 1) return 0;

  let running = Math.max(0, Math.floor(balance));
  let total = 0;

  for (let month = 0; month < months; month += 1) {
    const gain = monthlyInterestAmount(running, effectiveBps);
    if (gain < 1) break;
    total += gain;
    running += gain;
  }

  return total;
}

/** Sisa bulan penuh sampai kunci deposito berakhir. */
export function monthsRemainingUntil(lockedUntil: string | null, from = new Date()): number {
  if (!lockedUntil) return 0;
  const end = new Date(lockedUntil);
  if (Number.isNaN(end.getTime()) || end <= from) return 0;
  const months =
    (end.getFullYear() - from.getFullYear()) * 12 + (end.getMonth() - from.getMonth());
  return Math.max(0, end.getDate() >= from.getDate() ? months : months - 1);
}

export function formatInterestBps(bps: number): string {
  const pct = bps / 100;
  const formatted =
    pct % 1 === 0
      ? pct.toFixed(0)
      : Math.round(pct * 100) % 10 === 0
        ? pct.toFixed(1)
        : pct.toFixed(2);
  return `${formatted}%`;
}

/** Nilai awal field bunga % — dari basis poin, tanpa artefak float. */
export function bpsToPercentInputValue(bps: number): string {
  if (bps <= 0) return "";
  const whole = Math.floor(bps / 100);
  const frac = bps % 100;
  if (frac === 0) return String(whole);
  if (frac % 10 === 0) return `${whole}.${frac / 10}`;
  return `${whole}.${String(frac).padStart(2, "0")}`;
}

export function sanitizeInterestPercentInput(raw: string, previous = ""): string {
  const normalized = raw.replace(",", ".");
  if (normalized === "") return "";
  if (/^\d*\.?\d{0,2}$/.test(normalized)) return normalized;
  return previous;
}

export function parseInterestPercentInput(
  raw: string,
  maxBps: number = MONTHLY_INTEREST_ABS_MAX_BPS,
): { ok: true; bps: number } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(",", ".");
  const maxPct = maxBps / 100;

  if (!trimmed) {
    return { ok: true, bps: 0 };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: "Bunga gunakan angka dengan maksimal 2 desimal." };
  }

  const pct = Number(trimmed);
  if (!Number.isFinite(pct) || pct < 0) {
    return { ok: false, error: "Bunga tidak boleh negatif." };
  }

  if (pct > maxPct) {
    return { ok: false, error: `Bunga maksimal ${maxPct}% per bulan.` };
  }

  return { ok: true, bps: Math.round(pct * 100) };
}
