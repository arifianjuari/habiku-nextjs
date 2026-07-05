import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { fetchParentSavingsData } from "@/lib/savings/fetch-savings";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { DynamicParentSavingsView } from "@/components/parent/parent-dynamic-views";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";

export const metadata: Metadata = {
  title: "Tabungan — Habiku",
  robots: { index: false },
};

export default function ParentSavingsPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="parent" />}>
      <ParentSavingsContent />
    </Suspense>
  );
}

async function ParentSavingsContent() {
  const context = await getSessionContext();
  if (!context) redirect("/login");

  const data = await fetchParentSavingsData(context.family.id);

  return (
    <>
      <ParentPageHeaderSync
        title="Tabungan digital"
        description="Kantong tabungan per anak — setor energi dan setujui penarikan."
      />
      <DynamicParentSavingsView {...data} />
    </>
  );
}
