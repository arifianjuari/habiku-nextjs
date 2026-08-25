"use client";

import { ParentLedgerView } from "@/components/parent/parent-ledger-view";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { useParentLedgerData } from "@/lib/hooks/use-parent-ledger-data";

type ParentLedgerPageClientProps = {
  familyId: string;
};

export function ParentLedgerPageClient({ familyId }: ParentLedgerPageClientProps) {
  const { data, isLoading } = useParentLedgerData(familyId);

  if (isLoading && !data) {
    return <PageLoadingSkeleton variant="parent" />;
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-8 text-center text-sm text-muted-foreground">
        Gagal memuat buku besar. Coba muat ulang halaman.
      </div>
    );
  }

  return (
    <ParentLedgerView children={data.children} entriesByProfile={data.entriesByProfile} />
  );
}
