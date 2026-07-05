import type { QueryClient } from "@tanstack/react-query";
import {
  fetchFamilyChildrenClient,
  fetchFamilyGoalsClient,
  fetchFamilyTasksClient,
  fetchParentSavingsDataClient,
  fetchPendingTaskRequestsClient,
} from "@/lib/parent/fetch-family-page-data-client";
import { parentQueryKeys } from "@/lib/parent/query-keys";
import { seedParentListCache } from "@/lib/parent/seed-parent-list-cache";
import type { Goal } from "@/types/database";

export function prefetchParentTasks(queryClient: QueryClient, familyId: string) {
  return fetchFamilyChildrenClient(familyId).then((children) => {
    const childIds = children.map((c) => c.id);
    return Promise.all([
      fetchFamilyTasksClient(familyId, childIds).then((tasks) => {
        seedParentListCache(queryClient, parentQueryKeys.tasks(familyId), tasks);
      }),
      fetchPendingTaskRequestsClient(familyId, children).then((requests) => {
        seedParentListCache(
          queryClient,
          [...parentQueryKeys.tasks(familyId), "pending-requests"],
          requests,
        );
      }),
    ]);
  });
}

export function prefetchParentTargets(queryClient: QueryClient, familyId: string) {
  return fetchFamilyChildrenClient(familyId).then((children) =>
    fetchFamilyGoalsClient(familyId, children.map((c) => c.id)).then((goals) => {
      seedParentListCache(queryClient, parentQueryKeys.targets(familyId), goals);
    }),
  );
}

export function prefetchParentSavings(queryClient: QueryClient, familyId: string) {
  return fetchParentSavingsDataClient(familyId).then((data) => {
    seedParentListCache(queryClient, parentQueryKeys.savings(familyId), data);
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
  if (href.startsWith("/parent/profil-anak")) {
    return Promise.resolve();
  }
  return Promise.resolve();
}

export function goalsByProfileFromList(
  children: { id: string }[],
  goals: Goal[],
): Record<string, Goal[]> {
  return children.reduce<Record<string, Goal[]>>((acc, child) => {
    acc[child.id] = goals.filter((g) => g.profile_id === child.id);
    return acc;
  }, {});
}
