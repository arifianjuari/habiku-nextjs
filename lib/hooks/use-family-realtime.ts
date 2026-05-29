"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/env";

type UseFamilyRealtimeOptions = {
  /** ID profil anak dalam keluarga — dipakai untuk filter task_history & goals */
  childProfileIds: string[];
  /** ID akun ortu yang login — untuk notifikasi */
  accountId: string | null;
  enabled?: boolean;
  /** Dipanggil saat task_history atau goals berubah (mis. router.refresh di beranda ortu) */
  onFamilyDataChange?: () => void;
};

/**
 * Invalidate cache saat perubahan di tabel inti.
 * `task_history` tidak punya family_id — filter via profile_id (lihat database-architecture.md §4.6).
 */
export function useFamilyRealtime({
  childProfileIds,
  accountId,
  enabled = true,
  onFamilyDataChange,
}: UseFamilyRealtimeOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !hasSupabaseConfig()) return;
    if (childProfileIds.length === 0 && !accountId) return;

    const supabase = createClient();
    const channel = supabase.channel("family-realtime");

    for (const profileId of childProfileIds) {
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
          void queryClient.invalidateQueries({ queryKey: ["parent-queue"] });
          onFamilyDataChange?.();
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
          onFamilyDataChange?.();
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
  }, [childProfileIds, accountId, enabled, onFamilyDataChange, queryClient]);
}
