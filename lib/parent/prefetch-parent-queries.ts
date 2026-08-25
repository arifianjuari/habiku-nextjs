import type { QueryClient } from "@tanstack/react-query";
import {
  fetchParentProfilesPageData,
  fetchParentSavingsPageData,
  fetchParentTargetsPageData,
  fetchParentTasksPageData,
} from "@/lib/parent/fetch-parent-tab-page-data";
import { fetchParentQueuePageData } from "@/lib/parent/fetch-parent-queue-client";
import { parentIncidentalPageQueryKey } from "@/lib/hooks/use-parent-incidental-data";
import { parentLedgerPageQueryKey } from "@/lib/hooks/use-parent-ledger-data";
import { parentProfilesPageQueryKey } from "@/lib/hooks/use-parent-profiles-data";
import { parentSavingsPageQueryKey } from "@/lib/hooks/use-parent-savings-data";
import { parentTargetsPageQueryKey } from "@/lib/hooks/use-parent-targets-data";
import { parentTasksPageQueryKey } from "@/lib/hooks/use-parent-tasks-data";
import { parentQueuePageQueryKey } from "@/lib/hooks/use-parent-queue-data";
import { fetchParentIncidentalPageData } from "@/lib/parent/fetch-parent-incidental-client";
import { fetchParentLedgerPageData } from "@/lib/parent/fetch-parent-ledger-client";
import { parentQueryKeys } from "@/lib/parent/query-keys";
import { seedParentListCache } from "@/lib/parent/seed-parent-list-cache";
import { PARENT_STALE_MS } from "@/lib/query/constants";

export { goalsByProfileFromList } from "@/lib/parent/fetch-parent-tab-page-data";

function isQueryFresh(queryClient: QueryClient, queryKey: readonly unknown[]) {
  const state = queryClient.getQueryState(queryKey);
  if (!state?.dataUpdatedAt) return false;
  return Date.now() - state.dataUpdatedAt < PARENT_STALE_MS;
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
    staleTime: PARENT_STALE_MS,
  });
}

export function prefetchParentTasks(queryClient: QueryClient, familyId: string) {
  return prefetchIfStale(queryClient, parentTasksPageQueryKey(familyId), () =>
    fetchParentTasksPageData(familyId).then((data) => {
      seedParentListCache(queryClient, parentQueryKeys.tasks(familyId), data.tasks);
      seedParentListCache(
        queryClient,
        [...parentQueryKeys.tasks(familyId), "pending-requests"],
        data.pendingTaskRequests,
      );
      return data;
    }),
  );
}

export function prefetchParentTargets(queryClient: QueryClient, familyId: string) {
  return prefetchIfStale(queryClient, parentTargetsPageQueryKey(familyId), () =>
    fetchParentTargetsPageData(familyId).then((data) => {
      seedParentListCache(queryClient, parentQueryKeys.targets(familyId), data.goals);
      return data;
    }),
  );
}

export function prefetchParentSavings(queryClient: QueryClient, familyId: string) {
  return prefetchIfStale(queryClient, parentSavingsPageQueryKey(familyId), () =>
    fetchParentSavingsPageData(familyId).then((data) => {
      seedParentListCache(queryClient, parentQueryKeys.savings(familyId), data);
      return data;
    }),
  );
}

export function prefetchParentQueue(queryClient: QueryClient, familyId: string) {
  return prefetchIfStale(queryClient, parentQueuePageQueryKey(familyId), () =>
    fetchParentQueuePageData(familyId),
  );
}

export function prefetchParentProfiles(queryClient: QueryClient, familyId: string) {
  return prefetchIfStale(queryClient, parentProfilesPageQueryKey(familyId), () =>
    fetchParentProfilesPageData(familyId),
  );
}

export function prefetchParentLedger(queryClient: QueryClient, familyId: string) {
  return prefetchIfStale(queryClient, parentLedgerPageQueryKey(familyId), () =>
    fetchParentLedgerPageData(familyId),
  );
}

export function prefetchParentIncidental(queryClient: QueryClient, familyId: string) {
  return prefetchIfStale(queryClient, parentIncidentalPageQueryKey(familyId), () =>
    fetchParentIncidentalPageData(familyId),
  );
}

/** Prefetch bertahap — tabungan/emas paling berat, dijadwalkan terakhir. */
export function prefetchAllParentTabs(queryClient: QueryClient, familyId: string) {
  void prefetchParentTasks(queryClient, familyId);
  void prefetchParentProfiles(queryClient, familyId);
  const targetsTimer = window.setTimeout(() => {
    void prefetchParentTargets(queryClient, familyId);
  }, 350);
  const savingsTimer = window.setTimeout(() => {
    void prefetchParentSavings(queryClient, familyId);
  }, 900);

  return () => {
    window.clearTimeout(targetsTimer);
    window.clearTimeout(savingsTimer);
  };
}

export function prefetchParentTabData(
  queryClient: QueryClient,
  familyId: string,
  href: string,
) {
  if (href === "/parent" || href.startsWith("/parent/tasks")) {
    return prefetchParentTasks(queryClient, familyId);
  }
  if (href.startsWith("/parent/savings")) {
    return prefetchParentSavings(queryClient, familyId);
  }
  if (href.startsWith("/parent/targets")) {
    return prefetchParentTargets(queryClient, familyId);
  }
  if (href.startsWith("/parent/queue")) {
    return prefetchParentQueue(queryClient, familyId);
  }
  if (href.startsWith("/parent/profil-anak")) {
    return prefetchParentProfiles(queryClient, familyId);
  }
  if (href.startsWith("/parent/ledger")) {
    return prefetchParentLedger(queryClient, familyId);
  }
  return Promise.resolve();
}
