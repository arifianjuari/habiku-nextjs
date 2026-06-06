import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { fetchParentSavingsData } from "@/lib/savings/fetch-savings";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { ParentSavingsView } from "@/components/parent/parent-savings-view";

export const metadata: Metadata = {
  title: "Tabungan — Habiku",
  robots: { index: false },
};

export default async function ParentSavingsPage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");

  const data = await fetchParentSavingsData(context.family.id);

  return (
    <>
      <ParentPageHeaderSync
        title="Tabungan digital"
        description="Kantong tabungan per anak — setor energi dan setujui penarikan."
      />
      <ParentSavingsView {...data} />
    </>
  );
}
