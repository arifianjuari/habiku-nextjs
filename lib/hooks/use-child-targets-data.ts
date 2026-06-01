"use client";

import { useQuery } from "@tanstack/react-query";
import { childQueryKeys } from "@/lib/child/query-keys";
import { fetchChildTargetsData } from "@/lib/child/fetch-child-data";
import { isValidChildProfileId } from "@/lib/child/profile-id";

const CHILD_STALE_MS = 60_000;

export function useChildTargetsData(profileId: string | null) {
  const enabled = isValidChildProfileId(profileId);

  return useQuery({
    queryKey: enabled ? childQueryKeys.targets(profileId) : ["child", "targets", "disabled"],
    queryFn: () => fetchChildTargetsData(profileId!),
    enabled,
    staleTime: CHILD_STALE_MS,
    placeholderData: (prev) => prev,
  });
}
