"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  loadStickyMessages,
  type StickyMessages,
} from "@/lib/child/load-sticky-messages";
import { analyzeEvidenceImage } from "@/lib/services/ai";
import { sendTaskPendingWebPush } from "@/lib/push/send-task-pending-web-push";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { RPC } from "@/lib/database/rpc";
import type { ParentFrequencyType } from "@/lib/tasks/mission-frequency";
import {
  parseMaxSubmissionsPerPeriodNumber,
  parseParentFrequencyType,
} from "@/lib/tasks/mission-frequency";

export async function checkInChildAction(profileId: string) {
  if (!profileId) {
    return { error: "ID profil anak wajib disertakan." };
  }

  const supabase = await createClient();

  // Panggil RPC award_daily_checkin_bonus(p_profile_id)
  const { data, error } = await (supabase as any).rpc("award_daily_checkin_bonus", {
    p_profile_id: profileId,
  });

  if (error) {
    console.error("Error executing daily check-in RPC:", error);
    return { error: error.message || "Gagal melakukan check-in harian." };
  }

  revalidatePath("/child/home");
  revalidatePath("/parent");
  return { success: true, ...data };
}

export async function submitTaskEvidenceAction(
  taskId: string,
  profileId: string,
  notes: string,
  evidenceUrl: string | null
) {
  if (!taskId || !profileId) {
    return { error: "Task ID dan Profile ID wajib disertakan." };
  }

  const supabase = await createClient();

  // 1. Ambil detail misi untuk dikirim ke Gemini
  const { data: task } = await supabase
    .from("tasks")
    .select("title")
    .eq("id", taskId)
    .maybeSingle();

  // 2. Jalankan verifikasi AI Gemini jika ada bukti foto
  let finalNotes = notes ? notes.trim() : "";
  if (evidenceUrl && task) {
    try {
      const aiResult = await analyzeEvidenceImage(
        evidenceUrl,
        task.title,
        null
      );
      const aiString = `[AI_VERIFICATION_JSON_START]${JSON.stringify(aiResult)}[AI_VERIFICATION_JSON_END]`;
      finalNotes = finalNotes ? `${finalNotes}\n\n${aiString}` : aiString;
    } catch (aiErr) {
      console.error("AI verification failed in submit action:", aiErr);
    }
  }

  // 3. Memasukkan record baru ke task_history
  const { data, error } = await supabase
    .from("task_history")
    .insert({
      task_id: taskId,
      profile_id: profileId,
      notes: finalNotes || null,
      evidence_url: evidenceUrl,
      status: "pending",
      completed_at: new Date().toISOString(),
      period_date: null,
      approved_at: null,
      approved_by_account_id: null,
      rejected_at: null,
      rejected_by_account_id: null,
      rejection_reason: null,
      missed_at: null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error inserting task history:", error);
    return { error: error.message || "Gagal mengirim bukti penyelesaian misi." };
  }

  revalidatePath("/child/missions");
  revalidatePath("/parent");
  revalidatePath("/parent/queue");

  after(async () => {
    try {
      await sendTaskPendingWebPush(data.id);
    } catch (err) {
      console.error("[web-push] task pending:", err);
    }
  });

  return { success: true, historyItem: data };
}

export async function submitChildReflectionAction(
  profileId: string,
  mood: "sangat_senang" | "senang" | "biasa" | "kurang_senang",
  note: string
) {
  if (!profileId) {
    return { error: "ID profil anak wajib disertakan." };
  }
  if (!mood) {
    return { error: "Mood wajib dipilih." };
  }

  const supabase = await createClient();

  const { data, error } = await (supabase as any).rpc("submit_child_reflection", {
    p_profile_id: profileId,
    p_mood: mood,
    p_note: note ? note.trim() : null,
  });

  if (error) {
    console.error("Error executing submit_child_reflection RPC:", error);
    return { error: error.message || "Gagal mengirim refleksi sore." };
  }

  revalidatePath("/child/home");
  return { success: true, reflection: data };
}

export async function getChildStickyMessagesAction(
  profileId: string,
): Promise<StickyMessages> {
  if (!profileId) {
    return {
      personalStickyMessage: null,
      familyBroadcastMessage: null,
      stickyMessage: null,
    };
  }

  const supabase = await createClient();
  const { data: child } = await supabase
    .from("child_profiles")
    .select("family_id")
    .eq("id", profileId)
    .maybeSingle();

  return loadStickyMessages(supabase, profileId, child?.family_id);
}

function mapTaskRequestError(message: string): string {
  if (message.includes("title_required")) {
    return "Nama misi wajib diisi.";
  }
  if (message.includes("invalid_reward")) {
    return "Energi harus minimal 1.";
  }
  if (message.includes("invalid_max_submissions")) {
    return "Batas pengerjaan harus antara 1 dan 20.";
  }
  if (message.includes("invalid_frequency")) {
    return "Frekuensi misi tidak valid.";
  }
  if (message.includes("profile_not_found") || message.includes("forbidden")) {
    return "Profil anak tidak valid.";
  }
  return message || "Gagal mengajukan misi.";
}

export async function submitTaskRequestAction(
  profileId: string,
  title: string,
  requestedRewardPoints: number,
  frequencyType: ParentFrequencyType,
  maxSubmissionsPerPeriod: number,
  note?: string,
) {
  const context = await getSessionContext();
  if (!context) {
    return { error: "Sesi tidak valid." };
  }

  if (!profileId) {
    return { error: "ID profil anak wajib disertakan." };
  }

  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return { error: "Nama misi wajib diisi." };
  }

  const reward = Math.floor(requestedRewardPoints);
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
  const { data, error } = await (supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: { message: string } | null }>;
  }).rpc(RPC.submitTaskRequest, {
    p_profile_id: profileId,
    p_title: trimmedTitle,
    p_note: note?.trim() || null,
    p_requested_reward_points: reward,
    p_requested_frequency_type: frequency,
    p_requested_max_submissions_per_period: maxSubmissions,
  });

  if (error) {
    console.error("submit_task_request:", error);
    return { error: mapTaskRequestError(error.message) };
  }

  revalidatePath("/child/missions");
  revalidatePath("/parent/tasks");
  return { success: true, requestId: data };
}

export async function thankBroadcastAction(profileId: string) {
  if (!profileId) {
    return { error: "ID profil anak wajib disertakan." };
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc("thank_broadcast_message", {
    p_profile_id: profileId,
  });

  if (error) {
    console.error("thank_broadcast_message:", error);
    return { error: error.message || "Gagal mengirim terima kasih." };
  }

  return { success: true };
}

