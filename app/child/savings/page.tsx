import type { Metadata } from "next";
import { ChildSavingsView } from "@/components/child/child-savings-view";

export const metadata: Metadata = {
  title: "Tabungan",
};

export default function ChildSavingsPage() {
  return <ChildSavingsView />;
}
