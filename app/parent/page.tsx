import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { fetchParentDashboard } from "@/lib/parent/fetch-parent-dashboard";
import { ParentHomeView } from "@/components/parent/parent-home-view";

export const metadata: Metadata = {
  title: "Beranda Orang Tua — Habiku",
  description: "Dashboard keluarga: energi, misi, target, dan aktivitas anak.",
  robots: { index: false },
};

export default async function ParentHomePage() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  const { account, family } = context;
  const dashboard = await fetchParentDashboard(family.id, account, family);

  return <ParentHomeView {...dashboard} />;
}
