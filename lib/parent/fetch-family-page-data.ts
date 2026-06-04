import { createClient } from "@/lib/supabase/server";
import type { ChildProfile, Goal, Task } from "@/types/database";

export async function fetchFamilyChildren(familyId: string): Promise<ChildProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("family_id", familyId)
    .order("name", { ascending: true });

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
