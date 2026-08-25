import type { Metadata } from "next";
import { DynamicChildMissionsView } from "@/components/child/child-dynamic-views";

export const metadata: Metadata = {
  title: "Misi Saya",
};

export default function ChildMissionsPage() {
  return <DynamicChildMissionsView />;
}
