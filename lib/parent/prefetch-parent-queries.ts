import type { QueryClient } from "@tanstack/react-query";
import {
  fetchParentSavingsPageData,
  fetchParentTargetsPageData,
  fetchParentTasksPageData,
} from "@/lib/parent/fetch-parent-tab-page-data";
import { parentSavingsPageQueryKey } from "@/lib/hooks/use-parent-savings-data";
import { parentTargetsPageQueryKey } from "@/lib/hooks/use-parent-targets-data";
import { parentTasksPageQueryKey } from "@/lib/hooks/use-parent-tasks-data";
import { parentQueryKeys } from "@/lib/parent/query-keys";
import { seedParentListCache } from "@/lib/parent/seed-parent-list-cache";

export { goalsByProfileFromList } from "@/lib/parent/fetch-parent-tab-page-data";

export function prefetchParentTasks(queryClient: QueryClient, familyId: string) {
  return queryClient.prefetchQuery({
    queryKey: parentTasksPageQueryKey(familyId),
    queryFn: () =>
      fetchParentTasksPageData(familyId).then((data) => {
        seedParentListCache(queryClient, parentQueryKeys.tasks(familyId), data.tasks);
        seedParentListCache(
          queryClient,
          [...parentQueryKeys.tasks(familyId), "pending-requests"],
          data.pendingTaskRequests,
        );
        return data;
      }),
  });
}

export function prefetchParentTargets(queryClient: QueryClient, familyId: string) {
  return queryClient.prefetchQuery({
    queryKey: parentTargetsPageQueryKey(familyId),
    queryFn: () =>
      fetchParentTargetsPageData(familyId).then((data) => {
        seedParentListCache(queryClient, parentQueryKeys.targets(familyId), data.goals);
        return data;
      }),
  });
}

export function prefetchParentSavings(queryClient: QueryClient, familyId: string) {
  return queryClient.prefetchQuery({
    queryKey: parentSavingsPageQueryKey(familyId),
    queryFn: () =>
      fetchParentSavingsPageData(familyId).then((data) => {
        seedParentListCache(queryClient, parentQueryKeys.savings(familyId), data);
        return data;
      }),
  });
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
  return Promise.resolve();
}
