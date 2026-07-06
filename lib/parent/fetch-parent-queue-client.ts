import { createClient } from "@/lib/supabase/client";
import { fetchFamilyChildrenClient } from "@/lib/parent/fetch-family-page-data-client";
import type { ChildProfile, Goal, Task } from "@/types/database";

export type ParentQueueItem = {
  id: string;
  task_id: string;
  profile_id: string;
  notes: string | null;
  evidence_url: string | null;
  completed_at: string;
  child: ChildProfile;
  task: Task;
  childGoals: Goal[];
};

export type ParentQueuePageData = {
  queueItems: ParentQueueItem[];
  childProfileIds: string[];
};

export async function fetchParentQueuePageData(
  familyId: string,
): Promise<ParentQueuePageData> {
  const supabase = createClient();
  const children = await fetchFamilyChildrenClient(familyId, supabase);
  const childIds = children.map((c) => c.id);

  if (childIds.length === 0) {
    return { queueItems: [], childProfileIds: [] };
  }

  const [historyResult, tasksResult, goalsResult] = await Promise.all([
    supabase
      .from("task_history")
      .select("*")
      .in("profile_id", childIds)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase.from("tasks").select("*").in("profile_id", childIds),
    supabase
      .from("goals")
      .select("*")
      .in("profile_id", childIds)
      .eq("status", "active"),
  ]);

  const history = historyResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const goals = goalsResult.data ?? [];

  const queueItems = history
    .map((item) => {
      const child = children.find((c) => c.id === item.profile_id);
      const task = tasks.find((t) => t.id === item.task_id);
      const childGoals = goals.filter((g) => g.profile_id === item.profile_id);

      return {
        id: item.id,
        task_id: item.task_id,
        profile_id: item.profile_id,
        notes: item.notes,
        evidence_url: item.evidence_url,
        completed_at: item.completed_at,
        child: child!,
        task: task!,
        childGoals,
      };
    })
    .filter((item) => item.child && item.task);

  return { queueItems, childProfileIds: childIds };
}
