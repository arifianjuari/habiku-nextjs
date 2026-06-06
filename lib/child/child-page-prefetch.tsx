import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/query-client";
import { getServerChildProfileId } from "@/lib/child/get-server-child-profile-id";
import { createClient } from "@/lib/supabase/server";
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

type ChildPrefetchKey = "home" | "missions" | "targets" | "savings" | "garden" | "badges";

async function prefetchChildTab(
  queryClient: QueryClient,
  profileId: string,
  tab: ChildPrefetchKey,
) {
  const supabase = await createClient();

  const prefetchers: Record<ChildPrefetchKey, () => Promise<unknown>> = {
    home: () =>
      queryClient.prefetchQuery({
        queryKey: childQueryKeys.home(profileId),
        queryFn: () => fetchChildHomeData(profileId, supabase),
        staleTime: CHILD_STALE_MS,
      }),
    missions: () =>
      queryClient.prefetchQuery({
        queryKey: childQueryKeys.missions(profileId),
        queryFn: () => fetchChildMissionsData(profileId, supabase),
        staleTime: CHILD_STALE_MS,
      }),
    targets: () =>
      queryClient.prefetchQuery({
        queryKey: childQueryKeys.targets(profileId),
        queryFn: () => fetchChildTargetsData(profileId, supabase),
        staleTime: CHILD_STALE_MS,
      }),
    savings: () =>
      queryClient.prefetchQuery({
        queryKey: childQueryKeys.savings(profileId),
        queryFn: () => fetchChildSavingsDataClient(profileId, supabase),
        staleTime: CHILD_STALE_MS,
      }),
    garden: () =>
      queryClient.prefetchQuery({
        queryKey: childQueryKeys.garden(profileId),
        queryFn: () => fetchChildGardenGoals(profileId, supabase),
        staleTime: CHILD_STALE_MS,
      }),
    badges: () =>
      queryClient.prefetchQuery({
        queryKey: childQueryKeys.badges(profileId),
        queryFn: () => fetchChildBadgeKeys(profileId, supabase),
        staleTime: CHILD_STALE_MS,
      }),
  };

  await prefetchers[tab]();
}

export async function ChildPagePrefetch({
  tab,
  children,
}: {
  tab: ChildPrefetchKey;
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  const profileId = await getServerChildProfileId();

  if (profileId) {
    await prefetchChildTab(queryClient, profileId, tab);
  }

  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
