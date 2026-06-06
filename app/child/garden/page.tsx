import type { Metadata } from "next";
import { ChildGardenView } from "@/components/child/child-garden-view";
import { ChildPagePrefetch } from "@/lib/child/child-page-prefetch";

export const metadata: Metadata = {
  title: "Kebun energi",
};

export default function ChildGardenPage() {
  return (
    <ChildPagePrefetch tab="garden">
      <ChildGardenView />
    </ChildPagePrefetch>
  );
}
