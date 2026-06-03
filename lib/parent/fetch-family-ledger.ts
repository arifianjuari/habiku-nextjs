import { createClient } from "@/lib/supabase/server";
import type { LedgerEntryRow } from "@/lib/parent/ledger-display";

const LEDGER_PAGE_SIZE = 150;

export async function fetchFamilyLedgerEntries(
  profileIds: string[],
): Promise<LedgerEntryRow[]> {
  if (profileIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("point_ledger")
    .select(
      `
      id,
      profile_id,
      amount,
      type,
      created_at,
      task_history(
        notes,
        task:tasks(
          title,
          category
        )
      )
    `,
    )
    .in("profile_id", profileIds)
    .order("created_at", { ascending: false })
    .limit(LEDGER_PAGE_SIZE);

  if (error) {
    console.error("fetchFamilyLedgerEntries:", error);
    return [];
  }

  return (data ?? []) as LedgerEntryRow[];
}
