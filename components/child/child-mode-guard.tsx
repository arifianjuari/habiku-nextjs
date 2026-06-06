"use client";

import { useEffect } from "react";
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

export function ChildModeGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useChildModeHydrated();
  const isActive = useChildModeStore((s) => s.isActive);
  const profileId = useChildModeStore((s) => s.profileId);
  const exit = useChildModeStore((s) => s.exit);

  const isValidUuid = profileId ? UUID_REGEX.test(profileId) : false;
  const sessionReady = isActive && isValidUuid;

  useEffect(() => {
    if (!hydrated || sessionReady) return;

    if (isActive && profileId && !isValidUuid) {
      console.warn("Invalid child profileId UUID in Guard, exiting...", profileId);
      exit();
      toast.error("Sesi anak tidak valid. Silakan masuk kembali dari dasbor orang tua.");
    }

    router.replace("/parent/profil-anak");
  }, [hydrated, sessionReady, isActive, profileId, isValidUuid, exit, router]);

  useEffect(() => {
    if (sessionReady) {
      syncChildModeCookieFromStore();
    }
  }, [sessionReady]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6 text-center text-slate-500 font-semibold">
        Memuat mode anak…
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6 text-center text-slate-500 font-semibold">
        {isChildModeCookieActive() ? "Memulihkan sesi anak…" : "Mengalihkan ke dasbor orang tua…"}
      </div>
    );
  }

  return <>{children}</>;
}
