"use client";

import { useState } from "react";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { DynamicTargetsClientView } from "@/components/parent/parent-dynamic-views";
import type { ChildProfile, Goal } from "@/types/database";

type TargetsPageRootProps = {
  children: ChildProfile[];
  initialGoals: Goal[];
};

export function TargetsPageRoot({ children, initialGoals }: TargetsPageRootProps) {
  const [activeChildId, setActiveChildId] = useState(children[0]?.id ?? "");
  const activeChild = children.find((c) => c.id === activeChildId);

  return (
    <>
      <ParentPageHeaderSync
        title={`Target Hadiah ${activeChild?.name ?? ""}`.trim()}
        description="Atur hadiah impian anak yang ditebus menggunakan poin energi."
      />
      <DynamicTargetsClientView
        children={children}
        initialGoals={initialGoals}
        activeChildId={activeChildId}
        onActiveChildIdChange={setActiveChildId}
      />
    </>
  );
}
