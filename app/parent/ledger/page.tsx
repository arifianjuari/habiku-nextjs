import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { fetchFamilyChildren } from "@/lib/parent/fetch-family-page-data";
import { fetchFamilyLedgerEntries } from "@/lib/parent/fetch-family-ledger";
import { ParentLedgerView } from "@/components/parent/parent-ledger-view";
import type { LedgerEntryRow } from "@/lib/parent/ledger-display";

export const metadata: Metadata = {
  title: "Buku Besar Poin — Habiku",
  robots: { index: false },
};

export default async function ParentLedgerPage() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  const children = await fetchFamilyChildren(context.family.id);
  const profileIds = children.map((c) => c.id);
  const allEntries = await fetchFamilyLedgerEntries(profileIds);

  const entriesByProfile = profileIds.reduce<Record<string, LedgerEntryRow[]>>(
    (acc, id) => {
      acc[id] = allEntries.filter((e) => e.profile_id === id);
      return acc;
    },
    {},
  );

  return <ParentLedgerView children={children} entriesByProfile={entriesByProfile} />;
}
