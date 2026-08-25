import type { Metadata } from "next";
import { DynamicChildReflectionView } from "@/components/child/child-dynamic-views";

export const metadata: Metadata = {
  title: "Refleksi Sore — Habiku",
};

export default function ChildReflectionPage() {
  return <DynamicChildReflectionView />;
}
