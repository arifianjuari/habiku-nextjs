import { createClient } from "@/lib/supabase/server";
import type { ChildProfile, Goal, Task, TaskRequest } from "@/types/database";

export async function fetchFamilyChildren(familyId: string): Promise<ChildProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("family_id", familyId)
    .is("archived_at", null)
    .order("name", { ascending: true });

  return data ?? [];
}

export async function fetchArchivedFamilyChildren(
  familyId: string,
): Promise<ChildProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("family_id", familyId)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  return data ?? [];
}

/** Ambil anak + misi keluarga (misi difilter via profile_id anak di keluarga). */
export async function fetchFamilyChildrenAndTasks(familyId: string): Promise<{
  children: ChildProfile[];
  tasks: Task[];
}> {
  const supabase = await createClient();

  const { data: children, error: childrenError } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("family_id", familyId)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (childrenError) {
    console.error("Error fetching family children:", childrenError);
  }

  const childList = children ?? [];
  const childIds = childList.map((c) => c.id);

  if (childIds.length === 0) {
    return { children: childList, tasks: [] };
  }

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .in("profile_id", childIds)
    .order("created_at", { ascending: false });

  if (tasksError) {
    console.error("Error fetching family tasks:", tasksError);
  }

  return {
    children: childList,
    tasks: (tasks ?? []) as Task[],
  };
}

/** Ambil anak + target keluarga (target difilter via profile_id anak di keluarga). */
export async function fetchFamilyChildrenAndGoals(familyId: string): Promise<{
  children: ChildProfile[];
  goals: Goal[];
}> {
  const supabase = await createClient();

  const { data: children, error: childrenError } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("family_id", familyId)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (childrenError) {
    console.error("Error fetching family children:", childrenError);
  }

  const childList = children ?? [];
  const childIds = childList.map((c) => c.id);

  if (childIds.length === 0) {
    return { children: childList, goals: [] };
  }

  const { data: goals, error: goalsError } = await supabase
    .from("goals")
    .select("*")
    .in("profile_id", childIds)
    .order("created_at", { ascending: false });

  if (goalsError) {
    console.error("Error fetching family goals:", goalsError);
  }

  return {
    children: childList,
    goals: goals ?? [],
  };
}

export type PendingTaskRequest = TaskRequest & {
  child_name: string;
};

/** Pengajuan ide misi dari anak yang menunggu persetujuan ortu. */
export async function fetchPendingTaskRequests(
  familyId: string,
): Promise<PendingTaskRequest[]> {
  const supabase = await createClient();

  const { data: children, error: childrenError } = await supabase
    .from("child_profiles")
    .select("id, name")
    .eq("family_id", familyId)
    .is("archived_at", null);

  if (childrenError) {
    console.error("Error fetching children for task requests:", childrenError);
    return [];
  }

  const childList = children ?? [];
  const childIds = childList.map((c) => c.id);
  if (childIds.length === 0) {
    return [];
  }

  const nameById = new Map(childList.map((c) => [c.id, c.name]));

  const { data: requests, error: requestsError } = await supabase
    .from("task_requests")
    .select("*")
    .in("profile_id", childIds)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (requestsError) {
    console.error("Error fetching pending task requests:", requestsError);
    return [];
  }

  return (requests ?? []).map((request) => ({
    ...(request as TaskRequest),
    child_name: nameById.get(request.profile_id) ?? "Anak",
  }));
}
