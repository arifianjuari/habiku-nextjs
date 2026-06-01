import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { fetchFamilyChildren } from "@/lib/parent/fetch-family-page-data";
import { ChildProfilesList } from "@/components/parent/child-profiles-list";
import { EnterChildModeCard } from "@/components/parent/enter-child-mode-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Profil Anak — Habiku",
  robots: { index: false },
};

export default async function ParentChildProfilesPage() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  const children = await fetchFamilyChildren(context.family.id);

  return (
    <div className="space-y-6">
      <ChildProfilesList initialChildren={children} />

      <div className="pt-2 border-t border-slate-100">
        <EnterChildModeCard />
      </div>

      <Link
        href="/parent"
        className={cn(buttonVariants({ variant: "outline" }), "w-full rounded-xl cursor-pointer h-10 font-bold border-slate-200 text-slate-700")}
      >
        Kembali ke Beranda Ortu
      </Link>
    </div>
  );
}
