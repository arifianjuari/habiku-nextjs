import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { fetchFamilyChildren } from "@/lib/parent/fetch-family-page-data";
import { createClient } from "@/lib/supabase/server";
import { IncidentalRewardForm } from "@/components/parent/incidental-reward-form";
import type { Goal } from "@/types/database";

export const metadata: Metadata = {
  title: "Reward Insidental — Habiku",
  robots: { index: false },
};

export default async function ParentIncidentalPage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");

  const children = await fetchFamilyChildren(context.family.id);
  const profileIds = children.map((c) => c.id);

  const supabase = await createClient();
  const { data: goals } =
    profileIds.length > 0
      ? await supabase.from("goals").select("*").in("profile_id", profileIds)
      : { data: [] as Goal[] };

  const goalsByProfile = profileIds.reduce<Record<string, Goal[]>>((acc, id) => {
    acc[id] = (goals ?? []).filter((g) => g.profile_id === id);
    return acc;
  }, {});

  return (
    <div className="space-y-4 pb-8">
      <ParentPageHeaderSync
        title="Reward insidental"
        description="Beri apresiasi kilat di luar misi rutin harian."
        backHref="/parent/settings"
        backLabel="Kembali ke pengaturan"
      />
      <IncidentalRewardForm children={children} goalsByProfile={goalsByProfile} />
    </div>
  );
}
