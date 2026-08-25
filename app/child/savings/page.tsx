import type { Metadata } from "next";
import { DynamicChildSavingsView } from "@/components/child/child-dynamic-views";

export const metadata: Metadata = {
  title: "Tabungan",
};

export default function ChildSavingsPage() {
  return <DynamicChildSavingsView />;
}
