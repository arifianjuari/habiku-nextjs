"use client";

import { useQuery } from "@tanstack/react-query";
import { childQueryKeys } from "@/lib/child/query-keys";
import { fetchChildGardenGoals } from "@/lib/child/fetch-child-garden";
import { isValidChildProfileId } from "@/lib/child/profile-id";
import { CHILD_STALE_MS } from "@/lib/query/constants";

export function useChildGardenData(profileId: string | null) {
  const enabled = isValidChildProfileId(profileId);

  return useQuery({
    queryKey: enabled ? childQueryKeys.garden(profileId) : ["child", "garden", "disabled"],
    queryFn: () => fetchChildGardenGoals(profileId!),
    enabled,
    staleTime: CHILD_STALE_MS,
    placeholderData: (prev) => prev,
  });
}
