"use client";

import { useState } from "react";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { DynamicTargetsClientView } from "@/components/parent/parent-dynamic-views";
import type { PendingGoalRequest } from "@/lib/parent/fetch-family-page-data";
import type { ChildProfile, Goal } from "@/types/database";

type TargetsPageRootProps = {
  children: ChildProfile[];
  initialGoals: Goal[];
  pendingGoalRequests?: PendingGoalRequest[];
};

export function TargetsPageRoot({
  children,
  initialGoals,
  pendingGoalRequests = [],
}: TargetsPageRootProps) {
  const [activeChildId, setActiveChildId] = useState(children[0]?.id ?? "");
  const activeChild = children.find((c) => c.id === activeChildId);

  return (
    <>
      <ParentPageHeaderSync
        title={`Target Hadiah ${activeChild?.name ?? ""}`.trim()}
        description="Atur hadiah impian anak, dan tinjau target yang mereka ajukan beserta besaran energinya."
      />
      <DynamicTargetsClientView
        children={children}
        initialGoals={initialGoals}
        initialPendingGoalRequests={pendingGoalRequests}
        activeChildId={activeChildId}
        onActiveChildIdChange={setActiveChildId}
      />
    </>
  );
}
