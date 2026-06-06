"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TaskCategory, FrequencyType } from "@/lib/database/enums";
import { RPC } from "@/lib/database/rpc";
import {
  parseMaxSubmissionsPerPeriod,
  parseMaxSubmissionsPerPeriodNumber,
  parseParentFrequencyType,
  type ParentFrequencyType,
} from "@/lib/tasks/mission-frequency";

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
  const maxSubmissions = parseMaxSubmissionsPerPeriod(
    formData.get("maxSubmissionsPerPeriod"),
  );

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
  if (maxSubmissions === null) {
    return { error: "Batas pengerjaan harus angka minimal 1 (maks. 20)." };
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
      max_submissions_per_period: maxSubmissions,
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

export async function updateTask(prevState: unknown, formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "lainnya") as TaskCategory;
  const rewardPointsRaw = Number(formData.get("rewardPoints") ?? "10");
  const frequencyType = String(formData.get("frequencyType") ?? "daily") as FrequencyType;
  const maxSubmissions = parseMaxSubmissionsPerPeriod(
    formData.get("maxSubmissionsPerPeriod"),
  );

  if (!taskId) {
    return { error: "ID misi wajib disertakan." };
  }
  if (!title) {
    return { error: "Nama misi wajib diisi." };
  }
  if (rewardPointsRaw <= 0 || isNaN(rewardPointsRaw)) {
    return { error: "Poin reward harus berupa angka lebih dari 0." };
  }
  if (maxSubmissions === null) {
    return { error: "Batas pengerjaan harus angka minimal 1 (maks. 20)." };
  }

  const linkedAttribute = CATEGORY_ATTRIBUTE_MAP[category] || "attr_honesty";
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      title,
      category,
      reward_points: rewardPointsRaw,
      frequency_type: frequencyType,
      max_submissions_per_period: maxSubmissions,
      linked_attribute: linkedAttribute,
    })
    .eq("id", taskId)
    .select()
    .single();

  if (error) {
    console.error("Error updating task:", error);
    return { error: error.message || "Gagal memperbarui misi." };
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

function mapTaskRequestReviewError(message: string): string {
  if (message.includes("not_found")) {
    return "Pengajuan misi tidak ditemukan atau sudah diproses.";
  }
  if (message.includes("forbidden")) {
    return "Anda tidak berhak memproses pengajuan ini.";
  }
  if (message.includes("invalid_reward")) {
    return "Energi harus minimal 1.";
  }
  return message || "Gagal memproses pengajuan misi.";
}

export async function approveTaskRequestAction(
  requestId: string,
  rewardPoints: number,
  category: TaskCategory = "lainnya",
  frequencyType: ParentFrequencyType = "daily",
  maxSubmissionsPerPeriod = 1,
) {
  if (!requestId) {
    return { error: "ID pengajuan wajib disertakan." };
  }

  const reward = Math.floor(rewardPoints);
  if (!Number.isFinite(reward) || reward < 1) {
    return { error: "Energi harus minimal 1." };
  }

  const frequency = parseParentFrequencyType(frequencyType);
  if (!frequency) {
    return { error: "Frekuensi misi tidak valid." };
  }

  const maxSubmissions = parseMaxSubmissionsPerPeriodNumber(maxSubmissionsPerPeriod);
  if (maxSubmissions === null) {
    return { error: "Batas pengerjaan harus antara 1 dan 20." };
  }

  const supabase = await createClient();
  const { data: taskId, error } = await (supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: { message: string } | null }>;
  }).rpc(RPC.approveTaskRequest, {
    p_request_id: requestId,
    p_reward_points: reward,
    p_category: category,
    p_max_submissions_per_period: maxSubmissions,
    p_frequency_type: frequency,
  });

  if (error) {
    console.error("approve_task_request:", error);
    return { error: mapTaskRequestReviewError(error.message) };
  }

  if (!taskId) {
    return { error: "Misi dibuat tetapi ID tidak ditemukan." };
  }

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (fetchError || !task) {
    revalidatePath("/parent/tasks");
    revalidatePath("/child/missions");
    return { success: true, taskId };
  }

  revalidatePath("/parent/tasks");
  revalidatePath("/child/missions");
  return { success: true, taskId, task };
}

export async function rejectTaskRequestAction(requestId: string) {
  if (!requestId) {
    return { error: "ID pengajuan wajib disertakan." };
  }

  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
  }).rpc(RPC.rejectTaskRequest, {
    p_request_id: requestId,
  });

  if (error) {
    console.error("reject_task_request:", error);
    return { error: mapTaskRequestReviewError(error.message) };
  }

  revalidatePath("/parent/tasks");
  revalidatePath("/child/missions");
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

