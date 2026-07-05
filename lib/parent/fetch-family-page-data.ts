import { createClient } from "@/lib/supabase/server";
import { getFamilyChildren } from "@/lib/parent/parent-home-data";
import type { ChildProfile, Goal, Task, TaskRequest } from "@/types/database";

export async function fetchFamilyChildren(familyId: string): Promise<ChildProfile[]> {
  return getFamilyChildren(familyId);
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

export async function fetchFamilyTasks(
  familyId: string,
  childIds?: string[],
): Promise<Task[]> {
  const ids = childIds ?? (await getFamilyChildren(familyId)).map((c) => c.id);

  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .in("profile_id", ids)
    .order("created_at", { ascending: false });

  if (tasksError) {
    console.error("Error fetching family tasks:", tasksError);
  }

  return (tasks ?? []) as Task[];
}

export async function fetchFamilyGoals(
  familyId: string,
  childIds?: string[],
): Promise<Goal[]> {
  const ids = childIds ?? (await getFamilyChildren(familyId)).map((c) => c.id);

  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data: goals, error: goalsError } = await supabase
    .from("goals")
    .select("*")
    .in("profile_id", ids)
    .order("created_at", { ascending: false });

  if (goalsError) {
    console.error("Error fetching family goals:", goalsError);
  }

  return goals ?? [];
}

/** Ambil anak + misi keluarga (misi difilter via profile_id anak di keluarga). */
export async function fetchFamilyChildrenAndTasks(familyId: string): Promise<{
  children: ChildProfile[];
  tasks: Task[];
}> {
  const children = await getFamilyChildren(familyId);
  const tasks = await fetchFamilyTasks(familyId, children.map((c) => c.id));
  return { children, tasks };
}

/** Ambil anak + target keluarga (target difilter via profile_id anak di keluarga). */
export async function fetchFamilyChildrenAndGoals(familyId: string): Promise<{
  children: ChildProfile[];
  goals: Goal[];
}> {
  const children = await getFamilyChildren(familyId);
  const goals = await fetchFamilyGoals(familyId, children.map((c) => c.id));
  return { children, goals };
}

export type PendingTaskRequest = TaskRequest & {
  child_name: string;
};

/** Pengajuan ide misi dari anak yang menunggu persetujuan ortu. */
export async function fetchPendingTaskRequests(
  familyId: string,
  children?: ChildProfile[],
): Promise<PendingTaskRequest[]> {
  const childList = children ?? (await getFamilyChildren(familyId));
  const childIds = childList.map((c) => c.id);

  if (childIds.length === 0) return [];

  const nameById = new Map(childList.map((c) => [c.id, c.name]));
  const supabase = await createClient();

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
