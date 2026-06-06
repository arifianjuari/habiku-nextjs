"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  isChildModeCookieActive,
  syncChildModeCookieFromStore,
  useChildModeHydrated,
  useChildModeStore,
} from "@/lib/stores/child-mode-store";
import { toast } from "sonner";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REHYDRATE_RETRY_MS = 120;

export function ChildModeGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useChildModeHydrated();
  const isActive = useChildModeStore((s) => s.isActive);
  const profileId = useChildModeStore((s) => s.profileId);
  const exit = useChildModeStore((s) => s.exit);
  const rehydrateAttempted = useRef(false);

  const isValidUuid = profileId ? UUID_REGEX.test(profileId) : false;

  useEffect(() => {
    if (!hydrated) return;

    if (isActive && profileId && isValidUuid) {
      syncChildModeCookieFromStore();
      return;
    }

    // Setelah update PWA: beri satu kesempatan rehydrate sebelum menganggap sesi hilang
    if (
      !rehydrateAttempted.current &&
      isChildModeCookieActive() &&
      (!isActive || !profileId)
    ) {
      rehydrateAttempted.current = true;
      void useChildModeStore.persist.rehydrate();
      const timer = window.setTimeout(() => {
        const next = useChildModeStore.getState();
        if (next.isActive && next.profileId && UUID_REGEX.test(next.profileId)) {
          syncChildModeCookieFromStore();
          return;
        }
        router.replace("/parent/profil-anak");
      }, REHYDRATE_RETRY_MS);
      return () => window.clearTimeout(timer);
    }

    if (!isActive || !profileId || !isValidUuid) {
      if (isActive && profileId && !isValidUuid) {
        console.warn("Invalid child profileId UUID in Guard, exiting...", profileId);
        exit();
        toast.error("Sesi anak tidak valid. Silakan masuk kembali dari dasbor orang tua.");
      }
      router.replace("/parent/profil-anak");
    }
  }, [hydrated, isActive, profileId, isValidUuid, exit, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6 text-center text-slate-500 font-semibold">
        Memuat mode anak…
      </div>
    );
  }

  if (!isActive || !isValidUuid) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6 text-center text-slate-500 font-semibold">
        {isChildModeCookieActive() ? "Memulihkan sesi anak…" : "Mengalihkan ke dasbor orang tua…"}
      </div>
    );
  }

  return <>{children}</>;
}
