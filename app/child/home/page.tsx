import type { Metadata } from "next";
import { ChildHomeView } from "@/components/child/child-home-view";
import { ChildPagePrefetch } from "@/lib/child/child-page-prefetch";

export const metadata: Metadata = {
  title: "Beranda anak",
};

export default function ChildHomePage() {
  return (
    <ChildPagePrefetch tab="home">
      <ChildHomeView />
    </ChildPagePrefetch>
  );
}
