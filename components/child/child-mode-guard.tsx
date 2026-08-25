"use client";

import { useEffect } from "react";
import {
  isChildModeCookieActive,
  navigateToParentDashboardAfterChildExit,
  syncChildModeCookieFromStore,
  useChildModeHydrated,
  useChildModeStore,
} from "@/lib/stores/child-mode-store";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { toast } from "sonner";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ChildModeGuardProps = {
  children: React.ReactNode;
  /** Dari cookie server — izinkan first paint tanpa menunggu rehydrate Zustand. */
  serverSessionReady?: boolean;
  serverProfileId?: string | null;
};

export function ChildModeGuard({
  children,
  serverSessionReady = false,
  serverProfileId = null,
}: ChildModeGuardProps) {
  const hydrated = useChildModeHydrated();
  const isActive = useChildModeStore((s) => s.isActive);
  const profileId = useChildModeStore((s) => s.profileId);
  const exit = useChildModeStore((s) => s.exit);

  const effectiveProfileId = profileId ?? serverProfileId;
  const isValidUuid = effectiveProfileId ? UUID_REGEX.test(effectiveProfileId) : false;
  const clientSessionReady = isActive && isValidUuid;
  const sessionReady = serverSessionReady || clientSessionReady;

  useEffect(() => {
    if (serverSessionReady && serverProfileId && !isActive) {
      useChildModeStore.setState({
        isActive: true,
        profileId: serverProfileId,
      });
    }
  }, [serverSessionReady, serverProfileId, isActive]);

  useEffect(() => {
    if (!hydrated && !serverSessionReady) return;
    if (sessionReady) return;

    if (isActive && profileId && !isValidUuid) {
      console.warn("Invalid child profileId UUID in Guard, exiting...", profileId);
      exit();
      toast.error("Sesi anak tidak valid. Silakan masuk kembali dari dasbor orang tua.");
    }

    if (isChildModeCookieActive()) return;

    navigateToParentDashboardAfterChildExit();
  }, [
    hydrated,
    serverSessionReady,
    sessionReady,
    isActive,
    profileId,
    isValidUuid,
    exit,
  ]);

  useEffect(() => {
    if (sessionReady) {
      syncChildModeCookieFromStore();
    }
  }, [sessionReady]);

  if (!sessionReady) {
    if (!hydrated && !serverSessionReady) {
      return <PageLoadingSkeleton variant="child" className="min-h-[50vh]" />;
    }
    return <PageLoadingSkeleton variant="child" className="min-h-[50vh]" />;
  }

  return <>{children}</>;
}
