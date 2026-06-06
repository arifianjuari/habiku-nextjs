import type { Metadata } from "next";
import { ChildBadgeShelf } from "@/components/child/child-badge-shelf";
import { ChildPagePrefetch } from "@/lib/child/child-page-prefetch";

export const metadata: Metadata = {
  title: "Lencana Penghargaan — Habiku",
};

export default function ChildBadgesPage() {
  return (
    <ChildPagePrefetch tab="badges">
      <ChildBadgeShelf />
    </ChildPagePrefetch>
  );
}
