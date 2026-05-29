"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateFamilySettingsAction(
  microAnimEnabled: boolean,
  featuredMultiplier: "1.5x" | "2x" | "3x",
  dailyTipEnabled: boolean,
  showSiblingHighlight: boolean,
  checkInReminderEnabled: boolean,
  familyGardenEnabled: boolean
) {
  const supabase = await createClient();

  // Get active session user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Belum terautentikasi." };
  }

  // Fetch account to get family_id
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("family_id")
    .eq("id", user.id)
    .single();

  if (accountError || !account?.family_id) {
    return { error: "Keluarga tidak ditemukan." };
  }

  const { error } = await supabase
    .from("family_settings")
    .update({
      micro_anim_enabled: microAnimEnabled,
      featured_multiplier: featuredMultiplier,
      daily_tip_enabled: dailyTipEnabled,
      show_sibling_highlight: showSiblingHighlight,
      check_in_reminder_enabled: checkInReminderEnabled,
      family_garden_enabled: familyGardenEnabled,
      updated_by: user.id,
    })
    .eq("family_id", account.family_id);

  if (error) {
    console.error("Error updating family settings:", error);
    return { error: error.message || "Gagal menyimpan pengaturan." };
  }

  revalidatePath("/parent/settings/engagement");
  revalidatePath("/child/home");
  return { success: true };
}

export async function savePushSubscriptionAction(token: string) {
  if (!token) {
    return { error: "Token push wajib diisi." };
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Belum terautentikasi." };
  }

  const { error } = await supabase
    .from("account_push_tokens")
    .upsert({
      account_id: user.id,
      expo_push_token: token,
      platform: "web_pwa",
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Error saving push subscription token:", error);
    return { error: error.message || "Gagal menyimpan token notifikasi." };
  }

  return { success: true };
}

