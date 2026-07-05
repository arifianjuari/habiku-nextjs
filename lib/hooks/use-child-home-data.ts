"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { childQueryKeys } from "@/lib/child/query-keys";
import { fetchChildHomeData, type ChildHomeData } from "@/lib/child/fetch-child-data";
import { isValidChildProfileId } from "@/lib/child/profile-id";
import { CHILD_STALE_MS } from "@/lib/query/constants";

export function useChildHomeData(
  profileId: string | null,
  initialData?: ChildHomeData,
) {
  const enabled = isValidChildProfileId(profileId);

  return useQuery({
    queryKey: enabled ? childQueryKeys.home(profileId) : ["child", "home", "disabled"],
    queryFn: () => fetchChildHomeData(profileId!),
    enabled,
    staleTime: CHILD_STALE_MS,
    initialData: enabled && initialData ? initialData : undefined,
    placeholderData: (prev) => prev,
  });
}

export function usePatchChildHomeCache(profileId: string) {
  const queryClient = useQueryClient();

  return (patch: Partial<ChildHomeData>) => {
    queryClient.setQueryData<ChildHomeData>(childQueryKeys.home(profileId), (old) =>
      old ? { ...old, ...patch } : old,
    );
    if (patch.totalPoints !== undefined) {
      queryClient.setQueryData(childQueryKeys.points(profileId), patch.totalPoints);
    }
  };
}

export function useInvalidateChildHome(profileId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: childQueryKeys.home(profileId) });
    void queryClient.invalidateQueries({ queryKey: childQueryKeys.points(profileId) });
  };
}
