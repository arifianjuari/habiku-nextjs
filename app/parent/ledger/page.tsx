import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { fetchFamilyChildren } from "@/lib/parent/fetch-family-page-data";
import { fetchFamilyLedgerEntries } from "@/lib/parent/fetch-family-ledger";
import { ParentLedgerView } from "@/components/parent/parent-ledger-view";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import type { LedgerEntryRow } from "@/lib/parent/ledger-display";

export const metadata: Metadata = {
  title: "Buku Besar Poin — Habiku",
  robots: { index: false },
};

export default function ParentLedgerPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="parent" />}>
      <ParentLedgerContent />
    </Suspense>
  );
}

async function ParentLedgerContent() {
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
