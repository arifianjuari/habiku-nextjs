import type { Metadata } from "next";
import { ChildModeGuard } from "@/components/child/child-mode-guard";
import { ChildBottomNav } from "@/components/layout/child-bottom-nav";
import { ChildHeader } from "@/components/layout/child-header";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ChildLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChildModeGuard>
      <div className="flex min-h-full flex-col bg-gradient-to-b from-emerald-50 to-background pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <ChildHeader />
        <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4">{children}</div>
        <ChildBottomNav />
      </div>
    </ChildModeGuard>
  );
}
