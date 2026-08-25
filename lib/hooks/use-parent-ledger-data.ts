"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchParentLedgerPageData,
  type ParentLedgerData,
} from "@/lib/parent/fetch-parent-ledger-client";
import { parentQueryKeys } from "@/lib/parent/query-keys";
import { PARENT_STALE_MS } from "@/lib/query/constants";

export type { ParentLedgerData };

export function parentLedgerPageQueryKey(familyId: string) {
  return [...parentQueryKeys.ledger(familyId), "page"] as const;
}

export function useParentLedgerData(familyId: string) {
  return useQuery({
    queryKey: parentLedgerPageQueryKey(familyId),
    queryFn: () => fetchParentLedgerPageData(familyId),
    staleTime: PARENT_STALE_MS,
  });
}
