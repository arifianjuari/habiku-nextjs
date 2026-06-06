import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { createClient } from "@/lib/supabase/server";
import { QueueClientView } from "@/components/parent/queue-client-view";

export const metadata: Metadata = {
  title: "Antrean Persetujuan — Habiku",
  robots: { index: false },
};

export default async function ParentQueuePage() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  const { family } = context;
  const supabase = await createClient();

  // 1. Fetch children profiles
  const { data: childrenRaw, error: childrenError } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("family_id", family.id)
    .order("name", { ascending: true });

  const children = childrenRaw || [];
  const childIds = children.map((c) => c.id);

  if (childIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-slate-200 bg-white/70 backdrop-blur-md space-y-3">
        <p className="text-sm font-semibold text-slate-700">Belum ada anak terdaftar di keluarga Anda.</p>
        <p className="text-xs text-muted-foreground">Silakan tambahkan profil anak di menu Onboarding terlebih dahulu.</p>
      </div>
    );
  }

  // 2. Fetch pending task history entries
  const { data: historyRaw } = await supabase
    .from("task_history")
    .select("*")
    .in("profile_id", childIds)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const history = historyRaw || [];

  // 3. Fetch all tasks for these children (for mapping)
  const { data: tasksRaw } = await supabase
    .from("tasks")
    .select("*")
    .in("profile_id", childIds);

  const tasks = tasksRaw || [];

  // 4. Fetch all active goals for these children
  const { data: goalsRaw } = await supabase
    .from("goals")
    .select("*")
    .in("profile_id", childIds)
    .eq("status", "active");

  const goals = goalsRaw || [];

  // 5. Map and combine data
  const queueItems = history
    .map((item) => {
      const child = children.find((c) => c.id === item.profile_id);
      const task = tasks.find((t) => t.id === item.task_id);
      const childGoals = goals.filter((g) => g.profile_id === item.profile_id);

      return {
        id: item.id,
        task_id: item.task_id,
        profile_id: item.profile_id,
        notes: item.notes,
        evidence_url: item.evidence_url,
        completed_at: item.completed_at,
        child: child!,
        task: task!,
        childGoals,
      };
    })
    .filter((item) => item.child && item.task); // defensive exclusion

  return <QueueClientView initialQueueItems={queueItems} />;
}
