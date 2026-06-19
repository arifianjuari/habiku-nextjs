import type { Metadata } from "next";
import { ParentBottomNav } from "@/components/layout/parent-bottom-nav";
import { ParentHeaderBar } from "@/components/layout/parent-header-bar";
import { ParentPageHeaderProvider } from "@/components/layout/parent-page-header-context";
import { getSessionContext } from "@/lib/auth/get-session-context";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getSessionContext();
  const familyId = context?.family.id ?? null;

  return (
    <ParentPageHeaderProvider>
      <div className="flex min-h-full flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <ParentHeaderBar />
        <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4">{children}</div>
        <ParentBottomNav familyId={familyId} />
      </div>
    </ParentPageHeaderProvider>
  );
}
