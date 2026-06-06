"use client";

import { useState } from "react";
import { IncidentalRewardForm } from "@/components/parent/incidental-reward-form";
import type { ChildProfile, Goal } from "@/types/database";

type IncidentalPageRootProps = {
  children: ChildProfile[];
  goalsByProfile: Record<string, Goal[]>;
};

export function IncidentalPageRoot({ children, goalsByProfile }: IncidentalPageRootProps) {
  const [activeChildId, setActiveChildId] = useState(children[0]?.id ?? "");

  return (
    <IncidentalRewardForm
      children={children}
      goalsByProfile={goalsByProfile}
      profileId={activeChildId}
      onProfileIdChange={setActiveChildId}
    />
  );
}
