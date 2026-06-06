import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { fetchFamilyChildren } from "@/lib/parent/fetch-family-page-data";
import { ChildPinSettingsView } from "@/components/parent/child-pin-settings-view";

export const metadata: Metadata = {
  title: "PIN Child-lock — Habiku",
  robots: { index: false },
};

export default async function ParentChildPinSettingsPage() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  const children = await fetchFamilyChildren(context.family.id);

  return (
    <div className="space-y-4">
      <ChildPinSettingsView initialChildren={children} />
    </div>
  );
}
