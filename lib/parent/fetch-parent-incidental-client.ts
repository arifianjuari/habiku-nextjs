import { createClient } from "@/lib/supabase/client";
import {
  fetchFamilyChildrenClient,
  fetchFamilyGoalsClient,
} from "@/lib/parent/fetch-family-page-data-client";
import { goalsByProfileFromList } from "@/lib/parent/fetch-parent-tab-page-data";
import type { ChildProfile, Goal } from "@/types/database";

export type ParentIncidentalData = {
  children: ChildProfile[];
  goalsByProfile: Record<string, Goal[]>;
};

export async function fetchParentIncidentalPageData(
  familyId: string,
): Promise<ParentIncidentalData> {
  const supabase = createClient();
  const children = await fetchFamilyChildrenClient(familyId, supabase);
  const goals = await fetchFamilyGoalsClient(
    familyId,
    children.map((c) => c.id),
    supabase,
  );

  return {
    children,
    goalsByProfile: goalsByProfileFromList(children, goals),
  };
}
