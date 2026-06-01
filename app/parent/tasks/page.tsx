import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { fetchFamilyChildrenAndTasks } from "@/lib/parent/fetch-family-page-data";
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

  const { children, tasks } = await fetchFamilyChildrenAndTasks(context.family.id);

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
