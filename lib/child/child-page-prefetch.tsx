import type { ReactNode } from "react";

type ChildPrefetchKey = "home" | "missions" | "targets" | "savings" | "garden" | "badges";

/**
 * Wrapper halaman anak — prefetch ditangani klien (bottom nav + React Query)
 * agar navigasi tidak menunggu fetch server per tab.
 */
export function ChildPagePrefetch({
  children,
}: {
  tab: ChildPrefetchKey;
  children: ReactNode;
}) {
  return children;
}
