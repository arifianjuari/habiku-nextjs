"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { GoalStatus } from "@/lib/database/enums";

export async function createGoal(prevState: any, formData: FormData) {
  const childId = String(formData.get("childId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const targetHpRaw = Number(formData.get("targetHp") ?? "100");
  const makeActive = formData.get("makeActive") === "true";

  // Validation
  if (!childId) {
    return { error: "Profil anak wajib dipilih." };
  }
  if (!title) {
    return { error: "Nama target hadiah wajib diisi." };
  }
  if (targetHpRaw <= 0 || isNaN(targetHpRaw)) {
    return { error: "Target HP harus berupa angka lebih dari 0." };
  }

  const supabase = await createClient();

  // If the parent wants to make this goal the ONLY active one (traditional style, even if multiple are allowed),
  // they can do that. But our database now allows multiple active goals. We can just set status to 'active' or 'archived'.
  const status: GoalStatus = makeActive ? "active" : "archived";

  const { data, error } = await supabase
    .from("goals")
    .insert({
      profile_id: childId,
      title,
      target_hp: targetHpRaw,
      current_hp: 0,
      status,
      image_url: null,
      visual_state: "fresh",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating goal:", error);
    return { error: error.message || "Gagal membuat target hadiah." };
  }

  revalidatePath("/parent/targets");
  return { success: true, goal: data };
}

export async function toggleGoalStatus(goalId: string, currentStatus: GoalStatus) {
  if (!goalId) {
    return { error: "Goal ID wajib disertakan." };
  }

  const supabase = await createClient();
  const nextStatus: GoalStatus = currentStatus === "active" ? "archived" : "active";

  const { error } = await supabase
    .from("goals")
    .update({ status: nextStatus })
    .eq("id", goalId);

  if (error) {
    console.error("Error toggling goal status:", error);
    return { error: error.message || "Gagal mengubah status target." };
  }

  revalidatePath("/parent/targets");
  return { success: true };
}

export async function deleteGoal(goalId: string) {
  if (!goalId) {
    return { error: "Goal ID wajib disertakan." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", goalId);

  if (error) {
    console.error("Error deleting goal:", error);
    return { error: error.message || "Gagal menghapus target hadiah." };
  }

  revalidatePath("/parent/targets");
  return { success: true };
}
