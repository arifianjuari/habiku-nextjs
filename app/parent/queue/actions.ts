"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveTaskHistoryAction(taskHistoryId: string, goalId: string | null) {
  if (!taskHistoryId) {
    return { error: "ID riwayat misi wajib disertakan." };
  }

  const supabase = await createClient();

  // Panggil RPC approve_task_history(p_task_history_id, p_goal_id)
  const { error } = await (supabase as any).rpc("approve_task_history", {
    p_task_history_id: taskHistoryId,
    p_goal_id: goalId,
  });

  if (error) {
    console.error("Error approving task history:", error);
    return { error: error.message || "Gagal menyetujui misi anak." };
  }

  revalidatePath("/parent");
  revalidatePath("/parent/queue");
  revalidatePath("/parent/targets");
  return { success: true };
}

export async function rejectTaskHistoryAction(taskHistoryId: string, reason: string) {
  if (!taskHistoryId) {
    return { error: "ID riwayat misi wajib disertakan." };
  }
  if (!reason || !reason.trim()) {
    return { error: "Alasan penolakan wajib diisi." };
  }

  const supabase = await createClient();

  // Panggil RPC reject_task_history(p_task_history_id, p_reason)
  const { error } = await (supabase as any).rpc("reject_task_history", {
    p_task_history_id: taskHistoryId,
    p_reason: reason.trim(),
  });

  if (error) {
    console.error("Error rejecting task history:", error);
    return { error: error.message || "Gagal menolak misi anak." };
  }

  revalidatePath("/parent");
  revalidatePath("/parent/queue");
  return { success: true };
}
