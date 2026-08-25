import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { ParentIncidentalPageClient } from "@/components/parent/parent-incidental-page-client";

export const metadata: Metadata = {
  title: "Reward Insidental — Habiku",
  robots: { index: false },
};

export default async function ParentIncidentalPage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  return <ParentIncidentalPageClient familyId={context.family.id} />;
}
