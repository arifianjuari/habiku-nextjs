"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import {
  prefetchChildBadges,
  prefetchChildGarden,
  prefetchChildHome,
  prefetchChildMissions,
  prefetchChildSavings,
  prefetchChildTargets,
} from "@/lib/child/prefetch-child-queries";
import { isValidChildProfileId } from "@/lib/child/profile-id";

/**
 * Prefetch bertahap saat sesi mode anak siap.
 * Home tetap paling dulu; tab lain menyusul saat idle agar tab switch terasa native.
 */
export function ChildTabPrefetch() {
  const profileId = useChildModeStore((s) => s.profileId);
  const queryClient = useQueryClient();
  const warmedProfileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isValidChildProfileId(profileId)) return;
    if (warmedProfileRef.current === profileId) return;
    warmedProfileRef.current = profileId;

    const schedule =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 300);
    const timers: number[] = [];

    const idleId = schedule(() => {
      void prefetchChildHome(queryClient, profileId);
      timers.push(
        window.setTimeout(() => void prefetchChildMissions(queryClient, profileId), 250),
        window.setTimeout(() => void prefetchChildSavings(queryClient, profileId), 650),
        window.setTimeout(() => void prefetchChildTargets(queryClient, profileId), 900),
        window.setTimeout(() => void prefetchChildGarden(queryClient, profileId), 1200),
        window.setTimeout(() => void prefetchChildBadges(queryClient, profileId), 1500),
      );
    });

    return () => {
      if (typeof cancelIdleCallback === "function" && typeof idleId === "number") {
        cancelIdleCallback(idleId);
      }
      timers.forEach(window.clearTimeout);
    };
  }, [profileId, queryClient]);

  return null;
}
