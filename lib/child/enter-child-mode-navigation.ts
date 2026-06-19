import type { QueryClient } from "@tanstack/react-query";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { prefetchChildHome } from "@/lib/child/prefetch-child-queries";

/** Prefetch beranda anak di background — jangan blok navigasi. */
export function warmChildHomeData(queryClient: QueryClient, profileId: string) {
  void prefetchChildHome(queryClient, profileId);
}

export function navigateToChildHomeAfterEnter(
  queryClient: QueryClient,
  profileId: string,
  router: Pick<AppRouterInstance, "push">,
) {
  warmChildHomeData(queryClient, profileId);
  router.push("/child/home");
}
