import type { Metadata } from "next";
import { ChildSavingsView } from "@/components/child/child-savings-view";
import { ChildPagePrefetch } from "@/lib/child/child-page-prefetch";

export const metadata: Metadata = {
  title: "Tabungan",
};

export default function ChildSavingsPage() {
  return (
    <ChildPagePrefetch tab="savings">
      <ChildSavingsView />
    </ChildPagePrefetch>
  );
}
