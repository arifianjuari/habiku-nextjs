"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { RPC } from "@/lib/database/rpc";
import type { TaskCategory } from "@/lib/database/enums";
import type { Goal } from "@/types/database";

const INCIDENTAL_REWARD_ERRORS: Record<string, string> = {
  not_authenticated: "Sesi login berakhir. Silakan masuk kembali.",
  title_required: "Judul wajib diisi.",
  amount_required: "Isi minimal HP ke target atau energi bebas.",
  profile_not_found: "Profil anak tidak ditemukan.",
  forbidden: "Anda tidak memiliki akses ke profil anak ini.",
  goal_required: "Pilih target aktif jika memberi HP.",
  invalid_goal: "Target tidak valid atau tidak aktif.",
};

function mapIncidentalRewardError(message: string): string {
  const code = Object.keys(INCIDENTAL_REWARD_ERRORS).find((key) => message.includes(key));
  return code ? INCIDENTAL_REWARD_ERRORS[code] : message || "Gagal memberi reward insidental.";
}

export async function setFamilyBroadcastMessageAction(message: string) {
  const supabase = await createClient();
  const trimmed = message.trim();

  const { error } = await (supabase as any).rpc(RPC.setFamilyBroadcastMessage, {
    p_message: trimmed.length > 0 ? trimmed : null,
  });

  if (error) {
    console.error("set_family_broadcast_message:", error);
    return { error: error.message || "Gagal menyimpan pesan keluarga." };
  }

  revalidatePath("/parent");
  revalidatePath("/parent/profil-anak");
  revalidatePath("/child/home");
  return { success: true };
}

export async function setChildStickyMessageAction(profileId: string, message: string) {
  if (!profileId) {
    return { error: "Profil anak wajib dipilih." };
  }

  const supabase = await createClient();
  const trimmed = message.trim();

  const { error } = await (supabase as any).rpc(RPC.setChildParentStickyMessage, {
    p_profile_id: profileId,
    p_message: trimmed.length > 0 ? trimmed : null,
  });

  if (error) {
    console.error("set_child_parent_sticky_message:", error);
    return { error: error.message || "Gagal menyimpan sticky note." };
  }

  revalidatePath("/parent/profil-anak");
  revalidatePath("/child/home");
  return { success: true };
}

export async function giveIncidentalRewardAction(
  profileId: string,
  title: string,
  note: string,
  category: TaskCategory,
  hpToTarget: number,
  energyOnly: number,
  goalId: string | null,
) {
  if (!profileId || !title.trim()) {
    return { error: "Profil anak dan judul wajib diisi." };
  }
  if (hpToTarget <= 0 && energyOnly <= 0) {
    return { error: "Isi minimal HP ke target atau energi bebas." };
  }
  if (hpToTarget > 0 && !goalId) {
    return { error: "Pilih target aktif jika memberi HP." };
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc(RPC.giveIncidentalReward, {
    p_profile_id: profileId,
    p_title: title.trim(),
    p_note: note.trim() || null,
    p_category: category,
    p_hp_to_target: hpToTarget,
    p_energy_only: energyOnly,
    p_goal_id: goalId,
  });

  if (error) {
    console.error("give_incidental_reward:", error);
    return { error: mapIncidentalRewardError(error.message ?? "") };
  }

  let goal: Goal | undefined;
  if (goalId && hpToTarget > 0) {
    const { data: updatedGoal } = await supabase
      .from("goals")
      .select("*")
      .eq("id", goalId)
      .maybeSingle();
    goal = updatedGoal ?? undefined;
  }

  revalidatePath("/parent");
  revalidatePath("/parent/tasks");
  revalidatePath("/parent/targets");
  revalidatePath("/parent/ledger");
  revalidatePath(`/parent/goal/${profileId}`);
  revalidatePath("/child/home");
  return { success: true, goal };
}
