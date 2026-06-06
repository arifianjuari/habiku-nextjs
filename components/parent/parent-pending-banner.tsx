"use client";

import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";

type ParentPendingBannerProps = {
  pendingCount: number;
};

export function ParentPendingBanner({ pendingCount }: ParentPendingBannerProps) {
  if (pendingCount <= 0) return null;

  return (
    <Link
      href="/parent/queue"
      className="group flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 p-3.5 shadow-sm ring-1 ring-amber-200/50 transition-all duration-300 animate-in fade-in slide-in-from-top-1 hover:shadow-md"
    >
      <div
        className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700"
        aria-hidden
      >
        <Bell className="size-5" />
        <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-amber-500 ring-2 ring-amber-50" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <h3 className="text-sm font-bold text-amber-950">
          {pendingCount} misi menunggu persetujuan
        </h3>
        <p className="line-clamp-1 text-xs text-amber-900/80">
          Tinjau bukti anak agar energi masuk ke ledger.
        </p>
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-amber-700 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
