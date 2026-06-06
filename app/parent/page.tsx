import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { getFamilyChildIds } from "@/lib/parent/parent-home-data";
import { ParentHomeRealtime } from "@/components/parent/parent-home-realtime";
import { ParentHomeMainSection } from "@/components/parent/parent-home/parent-home-main-section";
import { ParentHomeActivitySection } from "@/components/parent/parent-home/parent-home-activity-section";
import {
  ParentHomeMainSkeleton,
  ParentHomeActivitySkeleton,
} from "@/components/parent/parent-home/parent-home-skeletons";

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
  const childProfileIds = await getFamilyChildIds(family.id);

  return (
    <ParentHomeRealtime childProfileIds={childProfileIds} accountId={account.id}>
      <div className="space-y-6 pb-2">
        <Suspense fallback={<ParentHomeMainSkeleton />}>
          <ParentHomeMainSection
            familyId={family.id}
            isPrimaryParent={account.role === "primary_parent"}
            displayName={account.display_name || "Orang Tua"}
          />
        </Suspense>

        <Suspense fallback={<ParentHomeActivitySkeleton />}>
          <ParentHomeActivitySection familyId={family.id} />
        </Suspense>
      </div>
    </ParentHomeRealtime>
  );
}
