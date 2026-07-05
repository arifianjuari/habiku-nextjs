"use client";

import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();

  useFamilyRealtime({
    childProfileIds,
    accountId,
    onFamilyDataChange: () => {
      void queryClient.invalidateQueries({ queryKey: ["parent"] });
    },
  });

  return <>{children}</>;
}
