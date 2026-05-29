"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TaskCategory, FrequencyType } from "@/lib/database/enums";

const CATEGORY_ATTRIBUTE_MAP: Record<TaskCategory, string> = {
  ibadah: "attr_discipline",
  belajar: "attr_responsibility",
  kebersihan: "attr_independence",
  olahraga: "attr_care",
  lainnya: "attr_honesty",
};

export async function createTask(prevState: any, formData: FormData) {
  const childId = String(formData.get("childId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "lainnya") as TaskCategory;
  const rewardPointsRaw = Number(formData.get("rewardPoints") ?? "10");
  const frequencyType = String(formData.get("frequencyType") ?? "daily") as FrequencyType;

  // Validation
  if (!childId) {
    return { error: "Profil anak wajib dipilih." };
  }
  if (!title) {
    return { error: "Nama misi wajib diisi." };
  }
  if (rewardPointsRaw <= 0 || isNaN(rewardPointsRaw)) {
    return { error: "Poin reward harus berupa angka lebih dari 0." };
  }

  const linkedAttribute = CATEGORY_ATTRIBUTE_MAP[category] || "attr_honesty";

  const supabase = await createClient();

  // Insert into tasks table
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      profile_id: childId,
      title,
      category,
      reward_points: rewardPointsRaw,
      frequency_type: frequencyType,
      frequency_config: {},
      max_submissions_per_period: 1,
      linked_attribute: linkedAttribute,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating task:", error);
    return { error: error.message || "Gagal membuat misi harian." };
  }

  revalidatePath("/parent/tasks");
  return { success: true, task: data };
}

export async function toggleTaskStatus(taskId: string, currentStatus: boolean) {
  if (!taskId) {
    return { error: "Task ID wajib disertakan." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ is_active: !currentStatus })
    .eq("id", taskId);

  if (error) {
    console.error("Error toggling task status:", error);
    return { error: error.message || "Gagal mengubah status misi." };
  }

  revalidatePath("/parent/tasks");
  return { success: true };
}

export async function deleteTask(taskId: string) {
  if (!taskId) {
    return { error: "Task ID wajib disertakan." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId);

  if (error) {
    console.error("Error deleting task:", error);
    return { error: error.message || "Gagal menghapus misi." };
  }

  revalidatePath("/parent/tasks");
  return { success: true };
}

export async function setChildFeaturedTaskAction(profileId: string, taskId: string | null) {
  if (!profileId) {
    return { error: "ID profil anak wajib disertakan." };
  }

  const supabase = await createClient();

  const { error } = await (supabase as any).rpc("set_child_featured_task", {
    p_profile_id: profileId,
    p_task_id: taskId,
  });

  if (error) {
    console.error("Error setting child featured task:", error);
    return { error: error.message || "Gagal mengatur misi sorotan." };
  }

  revalidatePath("/parent/tasks");
  revalidatePath("/child/home");
  return { success: true };
}

