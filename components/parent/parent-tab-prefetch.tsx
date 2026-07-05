"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  prefetchParentSavings,
  prefetchParentTargets,
  prefetchParentTasks,
} from "@/lib/parent/prefetch-parent-queries";

type ParentTabPrefetchProps = {
  familyId: string | null;
};

/**
 * Prefetch tab ortu saat idle — navigasi bottom nav pakai cache React Query,
 * bukan menunggu RSC fetch ulang.
 */
export function ParentTabPrefetch({ familyId }: ParentTabPrefetchProps) {
  const queryClient = useQueryClient();
  const warmedFamilyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!familyId) return;
    if (warmedFamilyRef.current === familyId) return;
    warmedFamilyRef.current = familyId;

    const schedule =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 400);

    const idleId = schedule(() => {
      void prefetchParentTasks(queryClient, familyId);
      void prefetchParentTargets(queryClient, familyId);
      void prefetchParentSavings(queryClient, familyId);
    });

    return () => {
      if (typeof cancelIdleCallback === "function" && typeof idleId === "number") {
        cancelIdleCallback(idleId);
      }
    };
  }, [familyId, queryClient]);

  return null;
}
