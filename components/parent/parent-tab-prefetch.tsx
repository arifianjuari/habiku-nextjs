"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchAllParentTabs } from "@/lib/parent/prefetch-parent-queries";

type ParentTabPrefetchProps = {
  familyId: string | null;
};

/**
 * Prefetch tab ortu saat idle — bertahap agar tidak membanjiri jaringan
 * (tabungan + emas virtual paling berat).
 */
export function ParentTabPrefetch({ familyId }: ParentTabPrefetchProps) {
  const queryClient = useQueryClient();
  const warmedFamilyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!familyId) return;
    if (warmedFamilyRef.current === familyId) return;
    warmedFamilyRef.current = familyId;

    let cancelScheduledPrefetch: (() => void) | undefined;

    const schedule =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 400);

    const idleId = schedule(() => {
      cancelScheduledPrefetch = prefetchAllParentTabs(queryClient, familyId);
    });

    return () => {
      if (typeof cancelIdleCallback === "function" && typeof idleId === "number") {
        cancelIdleCallback(idleId);
      }
      cancelScheduledPrefetch?.();
    };
  }, [familyId, queryClient]);

  return null;
}
