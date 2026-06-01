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

/** Ambil anak + misi keluarga secara paralel (satu round-trip DB per resource). */
export async function fetchFamilyChildrenAndTasks(familyId: string): Promise<{
  children: ChildProfile[];
  tasks: Task[];
}> {
  const supabase = await createClient();

  const [childrenResult, tasksResult] = await Promise.all([
    supabase
      .from("child_profiles")
      .select("*")
      .eq("family_id", familyId)
      .order("name", { ascending: true }),
    supabase
      .from("tasks")
      .select("*, child_profiles!inner(family_id)")
      .eq("child_profiles.family_id", familyId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    children: childrenResult.data ?? [],
    tasks: (tasksResult.data ?? []) as Task[],
  };
}

/** Ambil anak + target keluarga secara paralel. */
export async function fetchFamilyChildrenAndGoals(familyId: string): Promise<{
  children: ChildProfile[];
  goals: Goal[];
}> {
  const supabase = await createClient();

  const [childrenResult, goalsResult] = await Promise.all([
    supabase
      .from("child_profiles")
      .select("*")
      .eq("family_id", familyId)
      .order("name", { ascending: true }),
    supabase
      .from("goals")
      .select("*, child_profiles!inner(family_id)")
      .eq("child_profiles.family_id", familyId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    children: childrenResult.data ?? [],
    goals: goalsResult.data ?? [],
  };
}
