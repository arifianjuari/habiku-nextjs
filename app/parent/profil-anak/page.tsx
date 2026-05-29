import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { createClient } from "@/lib/supabase/server";
import { ChildProfilesList } from "@/components/parent/child-profiles-list";
import { EnterChildModeCard } from "@/components/parent/enter-child-mode-card";
import Link from "next/link";
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

  const { family } = context;
  const supabase = await createClient();

  // Fetch children for this family
  const { data: childrenRaw } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("family_id", family.id)
    .order("created_at", { ascending: true });

  const children = childrenRaw || [];

  return (
    <div className="space-y-6">
      {/* 1. Profil Anak CRUD Manager */}
      <ChildProfilesList initialChildren={children} />

      {/* 2. Mode Anak quick-entry */}
      <div className="pt-2 border-t border-slate-100">
        <EnterChildModeCard />
      </div>

      {/* 3. Navigation Links */}
      <Link
        href="/parent"
        className={cn(buttonVariants({ variant: "outline" }), "w-full rounded-xl cursor-pointer h-10 font-bold border-slate-200 text-slate-700")}
      >
        Kembali ke Beranda Ortu
      </Link>
    </div>
  );
}

