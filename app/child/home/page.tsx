import type { Metadata } from "next";
import { ChildHomeView } from "@/components/child/child-home-view";

export const metadata: Metadata = {
  title: "Beranda anak",
};

export default function ChildHomePage() {
  return <ChildHomeView />;
}

