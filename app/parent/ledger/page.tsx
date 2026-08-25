import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { ParentLedgerPageClient } from "@/components/parent/parent-ledger-page-client";

export const metadata: Metadata = {
  title: "Buku Besar Poin — Habiku",
  robots: { index: false },
};

export default async function ParentLedgerPage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  return <ParentLedgerPageClient familyId={context.family.id} />;
}
