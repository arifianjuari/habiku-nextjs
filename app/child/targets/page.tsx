import type { Metadata } from "next";
import { DynamicChildTargetsView } from "@/components/child/child-dynamic-views";

export const metadata: Metadata = {
  title: "Target",
};

export default function ChildTargetsPage() {
  return <DynamicChildTargetsView />;
}
