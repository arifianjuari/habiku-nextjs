import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import {
  fetchFamilyGoals,
  fetchFamilyTasks,
  fetchPendingTaskRequests,
} from "@/lib/parent/fetch-family-page-data";
import { getFamilyChildren } from "@/lib/parent/parent-home-data";
import { DynamicTasksClientView } from "@/components/parent/parent-dynamic-views";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import type { Goal } from "@/types/database";

export const metadata: Metadata = {
  title: "Kelola Misi — Habiku",
  robots: { index: false },
};

export default function ParentTasksPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="parent" />}>
      <ParentTasksContent />
    </Suspense>
  );
}

async function ParentTasksContent() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  const children = await getFamilyChildren(context.family.id);
  const childIds = children.map((c) => c.id);

  const [tasks, goals, pendingTaskRequests] = await Promise.all([
    fetchFamilyTasks(context.family.id, childIds),
    fetchFamilyGoals(context.family.id, childIds),
    fetchPendingTaskRequests(context.family.id, children),
  ]);

  const goalsByProfile = children.reduce<Record<string, Goal[]>>((acc, child) => {
    acc[child.id] = goals.filter((g) => g.profile_id === child.id);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {children.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-slate-200 bg-white/70 backdrop-blur-md space-y-3">
          <p className="text-sm font-semibold text-slate-700">Belum ada anak terdaftar di keluarga Anda.</p>
          <p className="text-xs text-muted-foreground">Silakan tambahkan profil anak di menu Onboarding atau Pengaturan terlebih dahulu.</p>
        </div>
      ) : (
        <DynamicTasksClientView
          children={children}
          initialTasks={tasks}
          goalsByProfile={goalsByProfile}
          initialPendingRequests={pendingTaskRequests}
        />
      )}
    </div>
  );
}
