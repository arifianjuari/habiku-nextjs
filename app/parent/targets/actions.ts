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

export async function updateGoal(prevState: unknown, formData: FormData) {
  const goalId = String(formData.get("goalId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const targetHpRaw = Number(formData.get("targetHp") ?? "100");

  if (!goalId) {
    return { error: "ID target wajib disertakan." };
  }
  if (!title) {
    return { error: "Nama target hadiah wajib diisi." };
  }
  if (targetHpRaw <= 0 || isNaN(targetHpRaw)) {
    return { error: "Target HP harus berupa angka lebih dari 0." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("goals")
    .update({
      title,
      target_hp: targetHpRaw,
    })
    .eq("id", goalId)
    .select()
    .single();

  if (error) {
    console.error("Error updating goal:", error);
    return { error: error.message || "Gagal memperbarui target hadiah." };
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

  const { data: goal, error: fetchError } = await supabase
    .from("goals")
    .select("id, current_hp, status")
    .eq("id", goalId)
    .single();

  if (fetchError || !goal) {
    return { error: "Target tidak ditemukan." };
  }

  if (goal.current_hp > 0 && goal.status !== "completed") {
    return {
      error: `Target masih berisi ${goal.current_hp} HP. Transfer ke target lain terlebih dahulu sebelum menghapus.`,
    };
  }

  const { error } = await supabase.from("goals").delete().eq("id", goalId);

  if (error) {
    console.error("Error deleting goal:", error);
    const message = error.message ?? "";
    if (message.includes("incidental_rewards")) {
      return {
        error:
          "Target tidak bisa dihapus karena terkait reward insidental. Terapkan migrasi database terbaru lalu coba lagi.",
      };
    }
    return { error: message || "Gagal menghapus target hadiah." };
  }

  revalidatePath("/parent/targets");
  return { success: true };
}

const TRANSFER_HP_ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: "Sesi login berakhir. Silakan masuk kembali.",
  goal_required: "Target asal dan tujuan wajib dipilih.",
  same_goal: "Target asal dan tujuan harus berbeda.",
  amount_required: "Jumlah HP minimal 1.",
  profile_not_found: "Profil anak tidak ditemukan.",
  forbidden: "Anda tidak memiliki akses ke profil anak ini.",
  invalid_from_goal: "Target asal tidak valid atau tidak aktif.",
  invalid_to_goal: "Target tujuan tidak valid atau tidak aktif.",
  insufficient_hp: "HP pada target asal tidak mencukupi.",
  destination_full: "Target tujuan sudah penuh.",
};

function mapTransferGoalHpError(message: string): string {
  const code = Object.keys(TRANSFER_HP_ERROR_MESSAGES).find((key) => message.includes(key));
  return code ? TRANSFER_HP_ERROR_MESSAGES[code] : message || "Gagal memindahkan HP antar target.";
}

export async function transferGoalHpAction(
  profileId: string,
  fromGoalId: string,
  toGoalId: string,
  amount: number,
  note?: string | null,
) {
  if (!profileId || !fromGoalId || !toGoalId) {
    return { error: "Profil anak dan target wajib dipilih." };
  }
  if (fromGoalId === toGoalId) {
    return { error: TRANSFER_HP_ERROR_MESSAGES.same_goal };
  }
  if (!Number.isInteger(amount) || amount < 1) {
    return { error: TRANSFER_HP_ERROR_MESSAGES.amount_required };
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc("transfer_goal_hp", {
    p_profile_id: profileId,
    p_from_goal_id: fromGoalId,
    p_to_goal_id: toGoalId,
    p_amount: amount,
    p_note: note?.trim() || null,
  });

  if (error) {
    console.error("transfer_goal_hp:", error);
    return { error: mapTransferGoalHpError(error.message ?? "") };
  }

  revalidatePath("/parent/targets");
  revalidatePath("/parent");
  revalidatePath(`/parent/goal/${profileId}`);
  revalidatePath("/child/home");
  return { success: true };
}
