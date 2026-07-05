"use client";

import { DynamicTasksClientView } from "@/components/parent/parent-dynamic-views";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { useParentTasksData } from "@/lib/hooks/use-parent-tasks-data";

type ParentTasksPageClientProps = {
  familyId: string;
};

export function ParentTasksPageClient({ familyId }: ParentTasksPageClientProps) {
  const { data, isLoading } = useParentTasksData(familyId);

  if (isLoading && !data) {
    return <PageLoadingSkeleton variant="parent" />;
  }

  if (!data || data.children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center space-y-3 rounded-3xl border border-slate-200 bg-white/70 p-8 text-center backdrop-blur-md">
        <p className="text-sm font-semibold text-slate-700">
          Belum ada anak terdaftar di keluarga Anda.
        </p>
        <p className="text-xs text-muted-foreground">
          Silakan tambahkan profil anak di menu Onboarding atau Pengaturan terlebih dahulu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DynamicTasksClientView
        children={data.children}
        initialTasks={data.tasks}
        goalsByProfile={data.goalsByProfile}
        initialPendingRequests={data.pendingTaskRequests}
      />
    </div>
  );
}
