"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { prefetchChildHome } from "@/lib/child/prefetch-child-queries";
import { isValidChildProfileId } from "@/lib/child/profile-id";

/**
 * Prefetch ringan saat sesi mode anak siap.
 * Tab lain di-warm lewat hover/touch di bottom nav agar tidak membanjiri jaringan.
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

    const idleId = schedule(() => {
      void prefetchChildHome(queryClient, profileId);
    });

    return () => {
      if (typeof cancelIdleCallback === "function" && typeof idleId === "number") {
        cancelIdleCallback(idleId);
      }
    };
  }, [profileId, queryClient]);

  return null;
}
