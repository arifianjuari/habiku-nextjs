import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { createClient } from "@/lib/supabase/server";
import {
  fetchArchivedFamilyChildren,
  fetchFamilyChildren,
} from "@/lib/parent/fetch-family-page-data";
import { ChildProfilesList } from "@/components/parent/child-profiles-list";
import { FamilyBroadcastEditor } from "@/components/parent/family-broadcast-editor";
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

  const [children, archivedChildren] = await Promise.all([
    fetchFamilyChildren(context.family.id),
    fetchArchivedFamilyChildren(context.family.id),
  ]);

  const supabase = await createClient();
  const { data: familyRow } = await supabase
    .from("families")
    .select("family_broadcast_message")
    .eq("id", context.family.id)
    .maybeSingle();

  const broadcastMessage =
    (familyRow as { family_broadcast_message?: string | null } | null)
      ?.family_broadcast_message ?? null;

  return (
    <div className="space-y-6">
      <FamilyBroadcastEditor initialMessage={broadcastMessage} />
      <ChildProfilesList
        initialChildren={children}
        initialArchivedChildren={archivedChildren}
      />

      <Link
        href="/parent/ledger"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-emerald-200 bg-emerald-50/30 font-bold text-emerald-800",
        )}
      >
        <BookOpen className="h-4 w-4" />
        Buku Besar Poin Keluarga
      </Link>

      <Link
        href="/parent"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-10 w-full cursor-pointer rounded-xl font-bold border-slate-200 text-slate-700",
        )}
      >
        Kembali ke Beranda Ortu
      </Link>
    </div>
  );
}
