import type { QueryClient } from "@tanstack/react-query";
import { childQueryKeys } from "@/lib/child/query-keys";
import {
  fetchChildHomeData,
  fetchChildMissionsData,
  fetchChildTargetsData,
} from "@/lib/child/fetch-child-data";
import { fetchChildGardenGoals } from "@/lib/child/fetch-child-garden";
import { fetchChildSavingsDataClient } from "@/lib/child/fetch-child-savings-client";
import { fetchChildBadgeKeys } from "@/lib/child/fetch-child-badges";
import { CHILD_STALE_MS } from "@/lib/query/constants";

export function prefetchChildHome(queryClient: QueryClient, profileId: string) {
  return queryClient.prefetchQuery({
    queryKey: childQueryKeys.home(profileId),
    queryFn: () => fetchChildHomeData(profileId),
    staleTime: CHILD_STALE_MS,
  });
}

export function prefetchChildMissions(queryClient: QueryClient, profileId: string) {
  return queryClient.prefetchQuery({
    queryKey: childQueryKeys.missions(profileId),
    queryFn: () => fetchChildMissionsData(profileId),
    staleTime: CHILD_STALE_MS,
  });
}

export function prefetchChildTargets(queryClient: QueryClient, profileId: string) {
  return queryClient.prefetchQuery({
    queryKey: childQueryKeys.targets(profileId),
    queryFn: () => fetchChildTargetsData(profileId),
    staleTime: CHILD_STALE_MS,
  });
}

export function prefetchChildSavings(queryClient: QueryClient, profileId: string) {
  return queryClient.prefetchQuery({
    queryKey: childQueryKeys.savings(profileId),
    queryFn: () => fetchChildSavingsDataClient(profileId),
    staleTime: CHILD_STALE_MS,
  });
}

export function prefetchChildGarden(queryClient: QueryClient, profileId: string) {
  return queryClient.prefetchQuery({
    queryKey: childQueryKeys.garden(profileId),
    queryFn: () => fetchChildGardenGoals(profileId),
    staleTime: CHILD_STALE_MS,
  });
}

export function prefetchChildBadges(queryClient: QueryClient, profileId: string) {
  return queryClient.prefetchQuery({
    queryKey: childQueryKeys.badges(profileId),
    queryFn: () => fetchChildBadgeKeys(profileId),
    staleTime: CHILD_STALE_MS,
  });
}

export function prefetchAllChildTabs(queryClient: QueryClient, profileId: string) {
  return Promise.all([
    prefetchChildHome(queryClient, profileId),
    prefetchChildMissions(queryClient, profileId),
    prefetchChildSavings(queryClient, profileId),
    prefetchChildTargets(queryClient, profileId),
    prefetchChildGarden(queryClient, profileId),
  ]);
}

export function prefetchChildTabData(
  queryClient: QueryClient,
  profileId: string,
  href: string,
) {
  if (href.startsWith("/child/home")) return prefetchChildHome(queryClient, profileId);
  if (href.startsWith("/child/missions")) return prefetchChildMissions(queryClient, profileId);
  if (href.startsWith("/child/savings")) return prefetchChildSavings(queryClient, profileId);
  if (href.startsWith("/child/targets")) return prefetchChildTargets(queryClient, profileId);
  if (href.startsWith("/child/garden")) return prefetchChildGarden(queryClient, profileId);
  if (href.startsWith("/child/badges")) return prefetchChildBadges(queryClient, profileId);
  return Promise.resolve();
}
