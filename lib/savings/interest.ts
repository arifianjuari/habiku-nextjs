import type { SavingsPocketRow } from "@/lib/savings/types";

/** Plafon kolom `monthly_interest_bps` / `max_monthly_interest_bps` (2000 = 20%/bulan). */
export const MONTHLY_INTEREST_ABS_MAX_BPS = 2000;

/** Basis poin per 10.000 (500 = 5%/bulan). */
export function effectiveMonthlyBps(pocket: Pick<SavingsPocketRow, "monthly_interest_bps" | "lock_bonus_coefficient">): number {
  return Math.floor(pocket.monthly_interest_bps * Number(pocket.lock_bonus_coefficient));
}

export function monthlyInterestAmount(principal: number, effectiveBps: number): number {
  if (principal < 1 || effectiveBps < 1) return 0;
  return Math.floor((principal * effectiveBps) / 10000);
}

/** Perkiraan total bunga — selaras dengan mesin akrual (simple interest). */
export function projectedInterestTotal(
  principal: number,
  pocket: Pick<SavingsPocketRow, "monthly_interest_bps" | "lock_bonus_coefficient" | "lock_months" | "pocket_type">,
  options?: { interestAccrued?: number; projectionMonths?: number },
): number {
  const monthly = monthlyInterestAmount(principal, effectiveMonthlyBps(pocket));
  if (monthly < 1) return 0;

  const accrued = options?.interestAccrued ?? 0;

  if (pocket.pocket_type === "term") {
    const lockMonths = pocket.lock_months ?? 0;
    return Math.max(0, monthly * lockMonths - accrued);
  }

  // flexible: proyeksi horizon (default 12 bulan) — mesin akrual membayar tiap bulan
  const horizon = options?.projectionMonths ?? 12;
  return monthly * horizon;
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
