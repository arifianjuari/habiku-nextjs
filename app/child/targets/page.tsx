import type { Metadata } from "next";
import { ChildTargetsView } from "@/components/child/child-targets-view";
import { ChildPagePrefetch } from "@/lib/child/child-page-prefetch";

export const metadata: Metadata = {
  title: "Target",
};

export default function ChildTargetsPage() {
  return (
    <ChildPagePrefetch tab="targets">
      <ChildTargetsView />
    </ChildPagePrefetch>
  );
}
