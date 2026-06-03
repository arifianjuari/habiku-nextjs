import type { Metadata } from "next";
import { ChildGardenView } from "@/components/child/child-garden-view";

export const metadata: Metadata = {
  title: "Kebun energi",
};

export default function ChildGardenPage() {
  return <ChildGardenView />;
}
