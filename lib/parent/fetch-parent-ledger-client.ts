import { createClient } from "@/lib/supabase/client";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { LedgerEntryRow } from "@/lib/parent/ledger-display";
import { fetchFamilyChildrenClient } from "@/lib/parent/fetch-family-page-data-client";
import type { ChildProfile } from "@/types/database";

const LEDGER_PAGE_SIZE = 150;

export type ParentLedgerData = {
  children: ChildProfile[];
  entriesByProfile: Record<string, LedgerEntryRow[]>;
};

async function fetchFamilyLedgerEntriesClient(
  profileIds: string[],
  supabase: AppSupabaseClient,
): Promise<LedgerEntryRow[]> {
  if (profileIds.length === 0) {
    return [];
  }

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
    console.error("fetchFamilyLedgerEntriesClient:", error);
    return [];
  }

  return (data ?? []) as LedgerEntryRow[];
}

export async function fetchParentLedgerPageData(familyId: string): Promise<ParentLedgerData> {
  const supabase = createClient();
  const children = await fetchFamilyChildrenClient(familyId, supabase);
  const profileIds = children.map((c) => c.id);
  const allEntries = await fetchFamilyLedgerEntriesClient(profileIds, supabase);

  const entriesByProfile = profileIds.reduce<Record<string, LedgerEntryRow[]>>((acc, id) => {
    acc[id] = allEntries.filter((e) => e.profile_id === id);
    return acc;
  }, {});

  return { children, entriesByProfile };
}
