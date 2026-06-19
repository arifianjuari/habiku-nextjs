import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { createClient } from "@/lib/supabase/server";
import { ChildDetailView } from "@/components/parent/child-detail-view";

type PageProps = {
  params: Promise<{ childId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { childId } = await params;
  const supabase = await createClient();

  const { data: child } = await supabase
    .from("child_profiles")
    .select("name")
    .eq("id", childId)
    .maybeSingle();

  return {
    title: child ? `Kemajuan RPG ${child.name} — Habiku` : "Kemajuan Anak",
    robots: { index: false },
  };
}

export default async function ChildDetailPage({ params }: PageProps) {
  const { childId } = await params;
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  const { family } = context;
  const supabase = await createClient();

  // 1. Fetch child profile & ensure it belongs to the logged-in family
  const { data: child, error: childError } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("id", childId)
    .eq("family_id", family.id)
    .maybeSingle();

  if (childError || !child) {
    redirect("/parent");
  }

  const [ledgerResult, streaksResult, goalsResult] = await Promise.all([
    supabase
      .from("point_ledger")
      .select(`
      id,
      profile_id,
      amount,
      type,
      created_at,
      task_history(
        notes,
        task:tasks(
          title,
          category
        )
      )
    `)
      .eq("profile_id", childId)
      .order("created_at", { ascending: false }),
    supabase.from("streaks").select("*").eq("profile_id", childId),
    supabase
      .from("goals")
      .select("*")
      .eq("profile_id", childId)
      .order("created_at", { ascending: false }),
  ]);

  const ledgerEntries = (ledgerResult.data || []) as any[];
  const streaks = streaksResult.data || [];
  const goals = goalsResult.data || [];

  // Calculate sum of points ledger for total energy
  const totalPoints = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div className="space-y-4">
      <ChildDetailView
        child={child}
        ledgerEntries={ledgerEntries}
        streaks={streaks}
        goals={goals}
        totalPoints={totalPoints}
      />
    </div>
  );
}
