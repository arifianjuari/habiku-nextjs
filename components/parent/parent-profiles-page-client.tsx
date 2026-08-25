"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { DynamicChildProfilesList } from "@/components/parent/parent-dynamic-views";
import { FamilyBroadcastEditor } from "@/components/parent/family-broadcast-editor";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { useParentProfilesData } from "@/lib/hooks/use-parent-profiles-data";
import { cn } from "@/lib/utils";

type ParentProfilesPageClientProps = {
  familyId: string;
};

export function ParentProfilesPageClient({ familyId }: ParentProfilesPageClientProps) {
  const { data, isLoading } = useParentProfilesData(familyId);

  if (isLoading && !data) {
    return <PageLoadingSkeleton variant="parent" />;
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-8 text-center text-sm text-muted-foreground">
        Gagal memuat profil anak. Coba muat ulang halaman.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FamilyBroadcastEditor initialMessage={data.broadcastMessage} />
      <DynamicChildProfilesList
        initialChildren={data.children}
        initialArchivedChildren={data.archivedChildren}
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
          "h-10 w-full cursor-pointer rounded-xl border-slate-200 font-bold text-slate-700",
        )}
      >
        Kembali ke Beranda Ortu
      </Link>
    </div>
  );
}
