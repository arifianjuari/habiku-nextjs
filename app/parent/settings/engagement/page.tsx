import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { createClient } from "@/lib/supabase/server";
import { EngagementSettingsView } from "@/components/parent/engagement-settings-view";

export const metadata: Metadata = {
  title: "Pengaturan Keterlibatan — Habiku",
  robots: { index: false },
};

export default async function ParentEngagementSettingsPage() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  const { family } = context;
  const supabase = await createClient();

  // Fetch family settings
  const { data: settingsRaw } = await supabase
    .from("family_settings")
    .select("*")
    .eq("family_id", family.id)
    .maybeSingle();

  // If settings don't exist, we fallback to initial defaults
  const settings = settingsRaw || {
    family_id: family.id,
    micro_anim_enabled: true,
    featured_multiplier: "2x",
    daily_tip_enabled: true,
    show_sibling_highlight: false,
    check_in_reminder_enabled: true,
    family_garden_enabled: true,
    savings_enabled: true,
    goal_save_enabled: true,
    savings_interest_enabled: true,
    gold_savings_enabled: false,
  };

  return (
    <div className="space-y-4">
      <EngagementSettingsView initialSettings={settings as any} />
    </div>
  );
}

