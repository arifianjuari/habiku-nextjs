"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  SHARED_FAMILY_GOAL_MAX_TARGET,
  SHARED_FAMILY_GOAL_MAX_TITLE_LENGTH,
  SHARED_FAMILY_GOAL_MIN_TARGET,
} from "@/lib/parent/family-shared-goal";

async function getParentFamilyId(): Promise<
  { familyId: string; userId: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Belum terautentikasi." };
  }

  const { data: account, error } = await supabase
    .from("accounts")
    .select("family_id, role")
    .eq("id", user.id)
    .single();

  if (error || !account?.family_id) {
    return { error: "Keluarga tidak ditemukan." };
  }

  if (account.role !== "primary_parent" && account.role !== "secondary_parent") {
    return { error: "Hanya orang tua yang dapat mengatur reward keluarga." };
  }

  return { familyId: account.family_id, userId: user.id };
}

export async function saveSharedFamilyGoalAction(title: string, targetPoints: number | null) {
  const ctx = await getParentFamilyId();
  if ("error" in ctx) return { error: ctx.error };

  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("family_settings")
      .update({
        shared_family_goal_title: null,
        shared_family_goal_target_points: null,
        shared_family_goal_celebration_dismissed: false,
        updated_by: ctx.userId,
      })
      .eq("family_id", ctx.familyId);

    if (error) {
      console.error("saveSharedFamilyGoalAction (clear):", error);
      return { error: error.message || "Gagal menghapus reward keluarga." };
    }

    revalidatePath("/parent");
    revalidatePath("/child/home");
    return { success: true as const };
  }

  if (trimmedTitle.length > SHARED_FAMILY_GOAL_MAX_TITLE_LENGTH) {
    return { error: `Judul maksimal ${SHARED_FAMILY_GOAL_MAX_TITLE_LENGTH} karakter.` };
  }

  if (
    targetPoints == null ||
    !Number.isInteger(targetPoints) ||
    targetPoints < SHARED_FAMILY_GOAL_MIN_TARGET ||
    targetPoints > SHARED_FAMILY_GOAL_MAX_TARGET
  ) {
    return {
      error: `Target energi harus antara ${SHARED_FAMILY_GOAL_MIN_TARGET} dan ${SHARED_FAMILY_GOAL_MAX_TARGET}.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("family_settings")
    .update({
      shared_family_goal_title: trimmedTitle,
      shared_family_goal_target_points: targetPoints,
      shared_family_goal_celebration_dismissed: false,
      updated_by: ctx.userId,
    })
    .eq("family_id", ctx.familyId);

  if (error) {
    console.error("saveSharedFamilyGoalAction:", error);
    return { error: error.message || "Gagal menyimpan reward keluarga." };
  }

  revalidatePath("/parent");
  revalidatePath("/child/home");
  return { success: true as const };
}

export async function dismissSharedFamilyGoalCelebrationAction() {
  const ctx = await getParentFamilyId();
  if ("error" in ctx) return { error: ctx.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("family_settings")
    .update({
      shared_family_goal_celebration_dismissed: true,
      updated_by: ctx.userId,
    })
    .eq("family_id", ctx.familyId);

  if (error) {
    console.error("dismissSharedFamilyGoalCelebrationAction:", error);
    return { error: error.message || "Gagal menutup selebrasi." };
  }

  revalidatePath("/parent");
  revalidatePath("/child/home");
  return { success: true as const };
}
