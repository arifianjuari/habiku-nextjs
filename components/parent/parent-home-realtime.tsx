"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFamilyRealtime } from "@/lib/hooks/use-family-realtime";

type ParentHomeRealtimeProps = {
  childProfileIds: string[];
  accountId: string;
  children: React.ReactNode;
};

export function ParentHomeRealtime({
  childProfileIds,
  accountId,
  children,
}: ParentHomeRealtimeProps) {
  const router = useRouter();
  const refreshTimerRef = useRef<number | null>(null);

  const handleFamilyDataChange = useCallback(() => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      router.refresh();
    }, 1500);
  }, [router]);

  useFamilyRealtime({
    childProfileIds,
    accountId,
    onFamilyDataChange: handleFamilyDataChange,
  });

  return <>{children}</>;
}
