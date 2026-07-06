"use client";

import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { DynamicQueueClientView } from "@/components/parent/parent-dynamic-views";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { useParentQueueData } from "@/lib/hooks/use-parent-queue-data";

type ParentQueuePageClientProps = {
  familyId: string;
};

export function ParentQueuePageClient({ familyId }: ParentQueuePageClientProps) {
  const { data, isLoading } = useParentQueueData(familyId);

  if (isLoading && !data) {
    return <PageLoadingSkeleton variant="parent" />;
  }

  if (!data) {
    return <PageLoadingSkeleton variant="parent" />;
  }

  if (data.childProfileIds.length === 0) {
    return (
      <>
        <ParentPageHeaderSync
          title="Antrean Persetujuan"
          description="Setujui bukti misi dan permintaan dari anak."
        />
        <div className="flex flex-col items-center justify-center space-y-3 rounded-3xl border border-slate-200 bg-white/70 p-8 text-center backdrop-blur-md">
          <p className="text-sm font-semibold text-slate-700">
            Belum ada anak terdaftar di keluarga Anda.
          </p>
          <p className="text-xs text-muted-foreground">
            Silakan tambahkan profil anak di menu Onboarding terlebih dahulu.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <ParentPageHeaderSync
        title="Antrean Persetujuan"
        description="Setujui bukti misi dan permintaan dari anak."
      />
      <DynamicQueueClientView
        initialQueueItems={data.queueItems}
        familyId={familyId}
        childProfileIds={data.childProfileIds}
      />
    </>
  );
}
