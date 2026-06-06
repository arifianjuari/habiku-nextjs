"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { prefetchAllChildTabs } from "@/lib/child/prefetch-child-queries";
import { isValidChildProfileId } from "@/lib/child/profile-id";

/** Prefetch semua tab anak setelah sesi mode anak siap. */
export function ChildTabPrefetch() {
  const profileId = useChildModeStore((s) => s.profileId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isValidChildProfileId(profileId)) return;
    void prefetchAllChildTabs(queryClient, profileId);
  }, [profileId, queryClient]);

  return null;
}
