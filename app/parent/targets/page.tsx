import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { ParentTargetsPageClient } from "@/components/parent/parent-targets-page-client";

export const metadata: Metadata = {
  title: "Kelola Target — Habiku",
  robots: { index: false },
};

export default async function ParentTargetsPage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  return <ParentTargetsPageClient familyId={context.family.id} />;
}
