import type { SavingsPocketRow } from "@/lib/savings/types";

/** Basis poin per 10.000 (500 = 5%/bulan). */
export function effectiveMonthlyBps(pocket: Pick<SavingsPocketRow, "monthly_interest_bps" | "lock_bonus_coefficient">): number {
  return Math.floor(pocket.monthly_interest_bps * Number(pocket.lock_bonus_coefficient));
}

export function monthlyInterestAmount(principal: number, effectiveBps: number): number {
  if (principal < 1 || effectiveBps < 1) return 0;
  return Math.floor((principal * effectiveBps) / 10000);
}

/** Perkiraan total bunga selama lock (simple, bukan compound). */
export function projectedInterestTotal(
  principal: number,
  pocket: Pick<SavingsPocketRow, "monthly_interest_bps" | "lock_bonus_coefficient" | "lock_months" | "pocket_type">,
): number {
  const monthly = monthlyInterestAmount(principal, effectiveMonthlyBps(pocket));
  const months = pocket.pocket_type === "term" ? (pocket.lock_months ?? 0) : 0;
  return monthly * months;
}

export function formatInterestBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}
