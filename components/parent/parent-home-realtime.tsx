"use client";

import { useMemo } from "react";
import { useFamilyRealtime } from "@/lib/hooks/use-family-realtime";

type ParentHomeRealtimeProps = {
  familyId: string;
  childProfileIds: string[];
  accountId: string;
  children: React.ReactNode;
};

export function ParentHomeRealtime({
  familyId,
  childProfileIds,
  accountId,
  children,
}: ParentHomeRealtimeProps) {
  const childProfileIdsKey = useMemo(() => [...childProfileIds].sort().join(","), [childProfileIds]);
  const stableChildProfileIds = useMemo(
    () => (childProfileIdsKey ? childProfileIdsKey.split(",") : []),
    [childProfileIdsKey],
  );

  useFamilyRealtime({
    familyId,
    childProfileIds: stableChildProfileIds,
    accountId,
  });

  return <>{children}</>;
}
