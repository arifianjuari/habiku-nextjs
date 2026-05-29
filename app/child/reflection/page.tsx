import type { Metadata } from "next";
import { ChildReflectionView } from "@/components/child/child-reflection-view";

export const metadata: Metadata = {
  title: "Refleksi Sore — Habiku",
};

export default function ChildReflectionPage() {
  return <ChildReflectionView />;
}
