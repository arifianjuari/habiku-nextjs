import type { Metadata } from "next";
import { ChildMissionsView } from "@/components/child/child-missions-view";
import { ChildPagePrefetch } from "@/lib/child/child-page-prefetch";

export const metadata: Metadata = {
  title: "Misi Saya",
};

export default function ChildMissionsPage() {
  return (
    <ChildPagePrefetch tab="missions">
      <ChildMissionsView />
    </ChildPagePrefetch>
  );
}
