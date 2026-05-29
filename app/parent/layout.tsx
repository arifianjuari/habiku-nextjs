import type { Metadata } from "next";
import { ParentBottomNav } from "@/components/layout/parent-bottom-nav";
import { ParentHeader } from "@/components/layout/parent-header";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <ParentHeader />
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4">{children}</div>
      <ParentBottomNav />
    </div>
  );
}
