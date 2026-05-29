import type { Metadata } from "next";
import { ChildBadgeShelf } from "@/components/child/child-badge-shelf";

export const metadata: Metadata = {
  title: "Lencana Penghargaan — Habiku",
};

export default function ChildBadgesPage() {
  return <ChildBadgeShelf />;
}
