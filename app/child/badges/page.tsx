import type { Metadata } from "next";
import { DynamicChildBadgeShelf } from "@/components/child/child-dynamic-views";

export const metadata: Metadata = {
  title: "Lencana Penghargaan — Habiku",
};

export default function ChildBadgesPage() {
  return <DynamicChildBadgeShelf />;
}
