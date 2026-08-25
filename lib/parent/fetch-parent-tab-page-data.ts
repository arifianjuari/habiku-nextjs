import {
  fetchArchivedFamilyChildrenClient,
  fetchFamilyChildrenClient,
  fetchFamilyGoalsClient,
  fetchFamilyTasksClient,
  fetchParentSavingsDataClient,
  fetchPendingTaskRequestsClient,
} from "@/lib/parent/fetch-family-page-data-client";
import { createClient } from "@/lib/supabase/client";
import type { PendingTaskRequest } from "@/lib/parent/fetch-family-page-data";
import type { ParentSavingsData } from "@/lib/savings/types";
import type { ChildProfile, Goal, Task } from "@/types/database";

export type ParentTasksData = {
  children: ChildProfile[];
  tasks: Task[];
  goalsByProfile: Record<string, Goal[]>;
  pendingTaskRequests: PendingTaskRequest[];
};

export type ParentTargetsData = {
  children: ChildProfile[];
  goals: Goal[];
};

export type ParentProfilesData = {
  children: ChildProfile[];
  archivedChildren: ChildProfile[];
  broadcastMessage: string | null;
};

function goalsByProfileFromList(
  children: { id: string }[],
  goals: Goal[],
): Record<string, Goal[]> {
  return children.reduce<Record<string, Goal[]>>((acc, child) => {
    acc[child.id] = goals.filter((g) => g.profile_id === child.id);
    return acc;
  }, {});
}

export async function fetchParentTasksPageData(familyId: string): Promise<ParentTasksData> {
  const children = await fetchFamilyChildrenClient(familyId);
  const childIds = children.map((c) => c.id);

  const [tasks, goals, pendingTaskRequests] = await Promise.all([
    fetchFamilyTasksClient(familyId, childIds),
    fetchFamilyGoalsClient(familyId, childIds),
    fetchPendingTaskRequestsClient(familyId, children),
  ]);

  return {
    children,
    tasks,
    goalsByProfile: goalsByProfileFromList(children, goals),
    pendingTaskRequests,
  };
}

export async function fetchParentTargetsPageData(familyId: string): Promise<ParentTargetsData> {
  const children = await fetchFamilyChildrenClient(familyId);
  const goals = await fetchFamilyGoalsClient(
    familyId,
    children.map((c) => c.id),
  );
  return { children, goals };
}

export async function fetchParentSavingsPageData(familyId: string): Promise<ParentSavingsData> {
  return fetchParentSavingsDataClient(familyId);
}

export async function fetchParentProfilesPageData(
  familyId: string,
): Promise<ParentProfilesData> {
  const supabase = createClient();
  const [children, archivedChildren, familyRow] = await Promise.all([
    fetchFamilyChildrenClient(familyId, supabase),
    fetchArchivedFamilyChildrenClient(familyId, supabase),
    supabase
      .from("families")
      .select("family_broadcast_message")
      .eq("id", familyId)
      .maybeSingle(),
  ]);

  return {
    children,
    archivedChildren,
    broadcastMessage:
      (familyRow.data as { family_broadcast_message?: string | null } | null)
        ?.family_broadcast_message ?? null,
  };
}

export { goalsByProfileFromList };
