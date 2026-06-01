"use client";

import { useCallback } from "react";
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

  const handleFamilyDataChange = useCallback(() => {
    router.refresh();
  }, [router]);

  useFamilyRealtime({
    childProfileIds,
    accountId,
    onFamilyDataChange: handleFamilyDataChange,
  });

  return <>{children}</>;
}
