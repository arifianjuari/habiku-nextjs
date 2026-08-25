"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/env";
import { parentQueryKeys } from "@/lib/parent/query-keys";

type UseFamilyRealtimeOptions = {
  /** ID profil anak dalam keluarga — dipakai untuk filter task_history & goals */
  childProfileIds: string[];
  /** ID akun ortu yang login — untuk notifikasi */
  accountId: string | null;
  enabled?: boolean;
};

/**
 * Invalidate cache saat perubahan di tabel inti.
 * `task_history` tidak punya family_id — filter via profile_id (lihat database-architecture.md §4.6).
 */
export function useFamilyRealtime({
  childProfileIds,
  accountId,
  enabled = true,
}: UseFamilyRealtimeOptions) {
  const queryClient = useQueryClient();
  const profileIdsKey = useMemo(
    () => [...childProfileIds].sort().join(","),
    [childProfileIds],
  );

  useEffect(() => {
    if (!enabled || !hasSupabaseConfig()) return;

    const profileIdList = profileIdsKey ? profileIdsKey.split(",") : [];
    if (profileIdList.length === 0 && !accountId) return;

    const supabase = createClient();
    const channelName = `family-realtime-${accountId ?? profileIdsKey}`;
    const channel = supabase.channel(channelName);

    for (const profileId of profileIdList) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_history",
          filter: `profile_id=eq.${profileId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["task-history", profileId] });
          void queryClient.invalidateQueries({ queryKey: parentQueryKeys.all });
        },
      );
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goals",
          filter: `profile_id=eq.${profileId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["goals", profileId] });
          void queryClient.invalidateQueries({ queryKey: parentQueryKeys.all });
        },
      );
    }

    if (accountId) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${accountId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications", accountId] });
        },
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profileIdsKey, accountId, enabled, queryClient]);
}
