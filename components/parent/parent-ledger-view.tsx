"use client";

import { useMemo, useState } from "react";
import { BookOpen, Zap } from "lucide-react";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PointLedgerList } from "@/components/parent/point-ledger-list";
import type { LedgerEntryRow } from "@/lib/parent/ledger-display";
import type { ChildProfile } from "@/types/database";
import { ChildAvatar } from "@/components/shared/child-avatar";

type ParentLedgerViewProps = {
  children: ChildProfile[];
  entriesByProfile: Record<string, LedgerEntryRow[]>;
};

export function ParentLedgerView({ children, entriesByProfile }: ParentLedgerViewProps) {
  const [activeChildId, setActiveChildId] = useState<string | "all">(
    children[0]?.id ?? "all",
  );

  const filteredEntries = useMemo(() => {
    if (activeChildId === "all") {
      return Object.values(entriesByProfile).flat();
    }
    return entriesByProfile[activeChildId] ?? [];
  }, [activeChildId, entriesByProfile]);

  const sortedEntries = useMemo(
    () =>
      [...filteredEntries].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [filteredEntries],
  );

  const totalForFilter = sortedEntries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <ParentPageHeaderSync
        title="Buku Besar Poin"
        description="Riwayat audit transaksi energi (append-only) per anak."
        backHref="/parent/profil-anak"
        backLabel="Kembali ke profil anak"
      />

      {children.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center text-xs text-muted-foreground">
          Belum ada profil anak. Tambahkan anak terlebih dahulu di menu Profil Anak.
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveChildId("all")}
              className={cn(
                "shrink-0 rounded-xl border px-3 py-2 text-[10px] font-bold transition-colors cursor-pointer",
                activeChildId === "all"
                  ? "border-emerald-600 bg-emerald-700 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              Semua Anak
            </button>
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => setActiveChildId(child.id)}
                className={cn(
                  "shrink-0 flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold transition-colors cursor-pointer",
                  activeChildId === child.id
                    ? "border-emerald-600 bg-emerald-700 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <ChildAvatar name={child.name} avatarUrl={child.avatar_url} avatarPreference={child.avatar_preference} avatarEmoji={child.avatar_emoji} accentColor={child.home_card_accent ?? "#8B5CF6"} className="h-6 w-6 shrink-0 rounded-lg text-[10px]" fallbackSizeClass="text-[10px]" />
                {child.name}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
              <BookOpen className="h-4 w-4 text-amber-600" />
              {sortedEntries.length} transaksi
            </div>
            <div className="flex items-center gap-1 text-xs font-extrabold text-amber-900">
              <Zap className="h-4 w-4 fill-amber-500 text-amber-500" />
              Saldo neto: {totalForFilter} E
            </div>
          </div>

          <PointLedgerList entries={sortedEntries} />
        </>
      )}
    </div>
  );
}
