import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionContext } from "@/lib/auth/get-session-context";
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
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Link
          href="/parent/settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 bg-white text-slate-600"
          aria-label="Kembali ke pengaturan"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-none mb-1">
            Reward insidental
          </h2>
          <p className="text-xs text-muted-foreground">
            Beri apresiasi kilat di luar misi rutin harian.
          </p>
        </div>
      </div>

      <IncidentalRewardForm children={children} goalsByProfile={goalsByProfile} />
    </div>
  );
}
