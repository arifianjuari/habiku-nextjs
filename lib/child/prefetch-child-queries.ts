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
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/types/database";

function isQueryFresh(queryClient: QueryClient, queryKey: readonly unknown[]) {
  const state = queryClient.getQueryState(queryKey);
  if (!state?.dataUpdatedAt) return false;
  return Date.now() - state.dataUpdatedAt < CHILD_STALE_MS;
}

function prefetchIfStale(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  queryFn: () => Promise<unknown>,
) {
  if (isQueryFresh(queryClient, queryKey)) return Promise.resolve();
  return queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: CHILD_STALE_MS,
  });
}

export function prefetchChildHome(queryClient: QueryClient, profileId: string) {
  const queryKey = childQueryKeys.home(profileId);
  return prefetchIfStale(queryClient, queryKey, () => fetchChildHomeData(profileId));
}

export function prefetchChildMissions(queryClient: QueryClient, profileId: string) {
  const queryKey = childQueryKeys.missions(profileId);
  return prefetchIfStale(queryClient, queryKey, () => fetchChildMissionsData(profileId));
}

export function prefetchChildTargets(queryClient: QueryClient, profileId: string) {
  const queryKey = childQueryKeys.targets(profileId);
  return prefetchIfStale(queryClient, queryKey, () => fetchChildTargetsData(profileId));
}

export function prefetchChildSavings(queryClient: QueryClient, profileId: string) {
  const queryKey = childQueryKeys.savings(profileId);
  return prefetchIfStale(queryClient, queryKey, () => fetchChildSavingsDataClient(profileId));
}

export function prefetchChildGarden(queryClient: QueryClient, profileId: string) {
  const queryKey = childQueryKeys.garden(profileId);
  return prefetchIfStale(queryClient, queryKey, () => fetchChildGardenGoals(profileId));
}

export function prefetchChildBadges(queryClient: QueryClient, profileId: string) {
  const queryKey = childQueryKeys.badges(profileId);
  return prefetchIfStale(queryClient, queryKey, () => fetchChildBadgeKeys(profileId));
}

export async function fetchChildTaskClient(taskId: string): Promise<Task | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function prefetchChildTask(queryClient: QueryClient, taskId: string) {
  return queryClient.prefetchQuery({
    queryKey: childQueryKeys.task(taskId),
    queryFn: () => fetchChildTaskClient(taskId),
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
    prefetchChildBadges(queryClient, profileId),
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
