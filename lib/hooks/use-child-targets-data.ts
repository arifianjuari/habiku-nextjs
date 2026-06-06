"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { childQueryKeys } from "@/lib/child/query-keys";
import { fetchChildTargetsData } from "@/lib/child/fetch-child-data";
import { isValidChildProfileId } from "@/lib/child/profile-id";
import { CHILD_STALE_MS } from "@/lib/query/constants";

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

export function useInvalidateChildTargets(profileId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: childQueryKeys.targets(profileId) });
  };
}
