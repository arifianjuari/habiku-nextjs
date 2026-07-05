"use client";

import { TargetsPageRoot } from "@/components/parent/targets-page-root";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { useParentTargetsData } from "@/lib/hooks/use-parent-targets-data";

type ParentTargetsPageClientProps = {
  familyId: string;
};

export function ParentTargetsPageClient({ familyId }: ParentTargetsPageClientProps) {
  const { data, isLoading } = useParentTargetsData(familyId);

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
      <TargetsPageRoot children={data.children} initialGoals={data.goals} />
    </div>
  );
}
