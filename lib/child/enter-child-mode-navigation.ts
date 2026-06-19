import type { QueryClient } from "@tanstack/react-query";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { prefetchAllChildTabs } from "@/lib/child/prefetch-child-queries";

export async function warmChildModeData(
  queryClient: QueryClient,
  profileId: string,
) {
  await prefetchAllChildTabs(queryClient, profileId);
}

export async function navigateToChildHomeAfterEnter(
  queryClient: QueryClient,
  profileId: string,
  router: Pick<AppRouterInstance, "push">,
) {
  await warmChildModeData(queryClient, profileId);
  router.push("/child/home");
}
