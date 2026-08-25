"use client";

import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { IncidentalPageRoot } from "@/components/parent/incidental-page-root";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { useParentIncidentalData } from "@/lib/hooks/use-parent-incidental-data";

type ParentIncidentalPageClientProps = {
  familyId: string;
};

export function ParentIncidentalPageClient({ familyId }: ParentIncidentalPageClientProps) {
  const { data, isLoading } = useParentIncidentalData(familyId);

  if (isLoading && !data) {
    return <PageLoadingSkeleton variant="parent" />;
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-8 text-center text-sm text-muted-foreground">
        Gagal memuat data reward insidental. Coba muat ulang halaman.
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <ParentPageHeaderSync
        title="Reward insidental"
        description="Beri apresiasi kilat di luar misi rutin harian."
        backHref="/parent/settings"
        backLabel="Kembali ke pengaturan"
      />
      <IncidentalPageRoot children={data.children} goalsByProfile={data.goalsByProfile} />
    </div>
  );
}
