import type { Metadata } from "next";
import { ChildTargetsView } from "@/components/child/child-targets-view";

export const metadata: Metadata = {
  title: "Target",
};

export default function ChildTargetsPage() {
  return <ChildTargetsView />;
}

