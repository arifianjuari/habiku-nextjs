import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { ParentSavingsPageClient } from "@/components/parent/parent-savings-page-client";

export const metadata: Metadata = {
  title: "Tabungan — Habiku",
  robots: { index: false },
};

export default async function ParentSavingsPage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  return <ParentSavingsPageClient familyId={context.family.id} />;
}
