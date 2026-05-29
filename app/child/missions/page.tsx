import type { Metadata } from "next";
import { ChildMissionsView } from "@/components/child/child-missions-view";

export const metadata: Metadata = {
  title: "Misi Saya",
};

export default function ChildMissionsPage() {
  return <ChildMissionsView />;
}
