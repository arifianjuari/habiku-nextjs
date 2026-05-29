import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/shared/section-placeholder";

export const metadata: Metadata = {
  title: "Kebun energi",
};

export default function ChildGardenPage() {
  return (
    <SectionPlaceholder
      title="Kebun energi"
      description="Galeri goal yang sudah tercapai — visual penghargaan jangka panjang."
      phase="W4"
    />
  );
}
