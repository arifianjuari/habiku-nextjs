import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { fetchParentSavingsData } from "@/lib/savings/fetch-savings";
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
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Tabungan digital
        </h1>
        <p className="text-sm text-muted-foreground">
          Kantong tabungan per anak — setor energi dan setujui penarikan.
        </p>
      </div>
      <ParentSavingsView {...data} />
    </div>
  );
}
