"use client";

import { useQuery } from "@tanstack/react-query";
import { childQueryKeys } from "@/lib/child/query-keys";
import { fetchChildBadgeKeys } from "@/lib/child/fetch-child-badges";
import { isValidChildProfileId } from "@/lib/child/profile-id";
import { CHILD_STALE_MS } from "@/lib/query/constants";

export function useChildBadgesData(profileId: string | null) {
  const enabled = isValidChildProfileId(profileId);

  return useQuery({
    queryKey: enabled ? childQueryKeys.badges(profileId) : ["child", "badges", "disabled"],
    queryFn: () => fetchChildBadgeKeys(profileId!),
    enabled,
    staleTime: CHILD_STALE_MS,
    placeholderData: (prev) => prev,
  });
}
