import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { createClient } from "@/lib/supabase/server";
import { TasksClientView } from "@/components/parent/tasks-client-view";

export const metadata: Metadata = {
  title: "Kelola Misi — Habiku",
  robots: { index: false },
};

export default async function ParentTasksPage() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  const { family } = context;
  const supabase = await createClient();

  // Fetch children profiles
  const { data: childrenRaw, error: childrenError } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("family_id", family.id)
    .order("name", { ascending: true });

  const children = childrenRaw || [];
  const childIds = children.map((c) => c.id);

  let tasks: any[] = [];
  if (childIds.length > 0) {
    // Fetch active and inactive tasks for these children profiles
    const { data: tasksRaw, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .in("profile_id", childIds)
      .order("created_at", { ascending: false });
    
    tasks = tasksRaw || [];
  }

  return (
    <div className="space-y-4">
      {children.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-slate-200 bg-white/70 backdrop-blur-md space-y-3">
          <p className="text-sm font-semibold text-slate-700">Belum ada anak terdaftar di keluarga Anda.</p>
          <p className="text-xs text-muted-foreground">Silakan tambahkan profil anak di menu Onboarding atau Pengaturan terlebih dahulu.</p>
        </div>
      ) : (
        <TasksClientView children={children} initialTasks={tasks} />
      )}
    </div>
  );
}
