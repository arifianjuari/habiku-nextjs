import type { Metadata } from "next";
import { DynamicChildHomeView } from "@/components/child/child-dynamic-views";

export const metadata: Metadata = {
  title: "Beranda anak",
};

export default function ChildHomePage() {
  return <DynamicChildHomeView />;
}
