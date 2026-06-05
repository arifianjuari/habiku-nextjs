"use client";

import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { getParentTimeGreeting } from "@/lib/parent/parent-greeting";

type ParentHomeHeaderSyncProps = {
  displayName: string;
};

/** Sinkronkan sapaan beranda ke sticky header parent. */
export function ParentHomeHeaderSync({ displayName }: ParentHomeHeaderSyncProps) {
  return (
    <ParentPageHeaderSync
      timeGreeting={getParentTimeGreeting()}
      title={`${displayName} 👋`}
    />
  );
}
