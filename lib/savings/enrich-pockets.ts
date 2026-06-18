import { projectedInterestTotal } from "@/lib/savings/interest";
import type { SavingsPocketRow, SavingsPocketWithBalance } from "@/lib/savings/types";
import type { createClient } from "@/lib/supabase/server";
import type { AppSupabaseClient } from "@/lib/supabase/types";

type SavingsSupabaseClient = AppSupabaseClient | Awaited<ReturnType<typeof createClient>>;

type SavingsTransactionRow = {
  pocket_id: string;
  kind: string;
  amount: number;
  withdraw_status: string | null;
  locked_until: string | null;
  interest_accrued: number;
  created_at: string;
};

function computeBalanceFromRows(rows: SavingsTransactionRow[]): number {
  return rows.reduce((sum, row) => {
    if (row.kind === "deposit" || row.kind === "interest") {
      return sum + row.amount;
    }
    if (row.kind === "withdraw" && row.withdraw_status === "approved") {
      return sum - row.amount;
    }
    return sum;
  }, 0);
}

function computeReservedFromRows(rows: SavingsTransactionRow[]): number {
  return rows
    .filter((row) => row.kind === "withdraw" && row.withdraw_status === "pending")
    .reduce((sum, row) => sum + row.amount, 0);
}

function isPocketLocked(pocket: SavingsPocketRow, rows: SavingsTransactionRow[]): boolean {
  if (pocket.pocket_type !== "term") return false;

  const now = Date.now();
  return rows.some(
    (row) =>
      row.kind === "deposit" &&
      row.locked_until !== null &&
      new Date(row.locked_until).getTime() > now,
  );
}

function getLatestDeposit(rows: SavingsTransactionRow[]): SavingsTransactionRow | undefined {
  return rows
    .filter((row) => row.kind === "deposit")
    .toSorted((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
}

export async function enrichPockets(
  supabase: SavingsSupabaseClient,
  pockets: SavingsPocketRow[],
): Promise<SavingsPocketWithBalance[]> {
  if (pockets.length === 0) return [];

  const pocketIds = pockets.map((pocket) => pocket.id);
  const { data: transactionRows } = await supabase
    .from("savings_transactions")
    .select(
      "pocket_id, kind, amount, withdraw_status, locked_until, interest_accrued, created_at",
    )
    .in("pocket_id", pocketIds);

  const rowsByPocket = new Map<string, SavingsTransactionRow[]>();
  for (const row of transactionRows ?? []) {
    const existing = rowsByPocket.get(row.pocket_id) ?? [];
    existing.push(row);
    rowsByPocket.set(row.pocket_id, existing);
  }

  return pockets.map((pocket) => {
    const rows = rowsByPocket.get(pocket.id) ?? [];
    const balance = computeBalanceFromRows(rows);
    const reserved = computeReservedFromRows(rows);
    const latestDeposit = getLatestDeposit(rows);
    const principal = balance > 0 ? balance : (latestDeposit?.amount ?? 0);

    return {
      ...pocket,
      balance,
      reserved,
      is_locked: isPocketLocked(pocket, rows),
      locked_until: latestDeposit?.locked_until ?? null,
      interest_accrued: latestDeposit?.interest_accrued ?? 0,
      projected_interest: projectedInterestTotal(principal, pocket),
    };
  });
}
