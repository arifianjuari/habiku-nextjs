import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { ParentProfilesPageClient } from "@/components/parent/parent-profiles-page-client";

export const metadata: Metadata = {
  title: "Profil Anak — Habiku",
  robots: { index: false },
};

/** Auth-only shell — data di-fetch klien via React Query (instant jika sudah di-prefetch). */
export default async function ParentChildProfilesPage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  return <ParentProfilesPageClient familyId={context.family.id} />;
}
