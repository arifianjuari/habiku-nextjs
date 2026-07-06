import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { ParentQueuePageClient } from "@/components/parent/parent-queue-page-client";

export const metadata: Metadata = {
  title: "Antrean Persetujuan — Habiku",
  robots: { index: false },
};

export default async function ParentQueuePage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  return <ParentQueuePageClient familyId={context.family.id} />;
}
