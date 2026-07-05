import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { ParentTasksPageClient } from "@/components/parent/parent-tasks-page-client";

export const metadata: Metadata = {
  title: "Kelola Misi — Habiku",
  robots: { index: false },
};

/** Auth-only shell — data di-fetch klien via React Query (instant jika sudah di-prefetch). */
export default async function ParentTasksPage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  return <ParentTasksPageClient familyId={context.family.id} />;
}
