"use client";

import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { DynamicParentSavingsView } from "@/components/parent/parent-dynamic-views";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { useParentSavingsData } from "@/lib/hooks/use-parent-savings-data";

type ParentSavingsPageClientProps = {
  familyId: string;
};

export function ParentSavingsPageClient({ familyId }: ParentSavingsPageClientProps) {
  const { data, isLoading } = useParentSavingsData(familyId);

  if (isLoading && !data) {
    return <PageLoadingSkeleton variant="parent" />;
  }

  if (!data) {
    return <PageLoadingSkeleton variant="parent" />;
  }

  return (
    <>
      <ParentPageHeaderSync
        title="Tabungan"
        description="Kantong tabungan energi dan Tabung Emas virtual per anak."
      />
      <DynamicParentSavingsView {...data} />
    </>
  );
}
