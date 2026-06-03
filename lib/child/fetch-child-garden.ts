import { createClient } from "@/lib/supabase/client";
import type { Goal } from "@/types/database";

export type GardenGoal = Pick<
  Goal,
  "id" | "title" | "image_url" | "target_hp" | "current_hp" | "updated_at"
>;

export async function fetchChildGardenGoals(profileId: string): Promise<GardenGoal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .select("id, title, image_url, target_hp, current_hp, updated_at")
    .eq("profile_id", profileId)
    .eq("status", "completed")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
