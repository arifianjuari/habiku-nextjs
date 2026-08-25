"use client";

import { useMemo } from "react";
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
  const stableChildProfileIds = useMemo(
    () => [...childProfileIds].sort(),
    [childProfileIds.join(",")],
  );

  useFamilyRealtime({
    childProfileIds: stableChildProfileIds,
    accountId,
  });

  return <>{children}</>;
}
