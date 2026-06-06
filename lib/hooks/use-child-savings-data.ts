"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { childQueryKeys } from "@/lib/child/query-keys";
import { fetchChildSavingsDataClient } from "@/lib/child/fetch-child-savings-client";
import type { ChildSavingsData } from "@/lib/savings/types";
import { isValidChildProfileId } from "@/lib/child/profile-id";
import { CHILD_STALE_MS } from "@/lib/query/constants";

export function useChildSavingsData(profileId: string | null) {
  const enabled = isValidChildProfileId(profileId);

  return useQuery({
    queryKey: enabled ? childQueryKeys.savings(profileId) : ["child", "savings", "disabled"],
    queryFn: () => fetchChildSavingsDataClient(profileId!),
    enabled,
    staleTime: CHILD_STALE_MS,
    placeholderData: (prev) => prev,
  });
}

export function useInvalidateChildSavings(profileId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: childQueryKeys.savings(profileId) });
  };
}

export function usePatchChildSavingsCache(profileId: string) {
  const queryClient = useQueryClient();
  return (patch: Partial<ChildSavingsData>) => {
    queryClient.setQueryData<ChildSavingsData>(childQueryKeys.savings(profileId), (old) =>
      old ? { ...old, ...patch } : old,
    );
  };
}
