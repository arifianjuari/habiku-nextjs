"use client";

import { Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  formatLedgerDate,
  getLedgerDisplayDetail,
  type LedgerEntryRow,
} from "@/lib/parent/ledger-display";

type PointLedgerListProps = {
  entries: LedgerEntryRow[];
  emptyMessage?: string;
};

export function PointLedgerList({
  entries,
  emptyMessage = "Belum ada transaksi poin ledger yang tercatat.",
}: PointLedgerListProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-10 rounded-3xl border-2 border-dashed border-slate-200 bg-white/40 backdrop-blur-sm text-slate-400 text-xs">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {entries.map((entry) => {
        const detail = getLedgerDisplayDetail(entry);
        return (
          <Card
            key={entry.id}
            className="border border-slate-150 bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
          >
            <CardContent className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm font-black",
                    detail.color,
                  )}
                >
                  {detail.amountSign}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h5 className="font-bold text-xs text-slate-900 leading-snug truncate">
                    {detail.title}
                  </h5>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-muted-foreground font-semibold">
                    <span>{detail.desc}</span>
                    <span aria-hidden>•</span>
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-2.5 w-2.5" />
                      {formatLedgerDate(entry.created_at)}
                    </span>
                  </div>
                </div>
              </div>
              <span
                className={cn(
                  "text-sm font-black tabular-nums shrink-0",
                  detail.pointsColor,
                )}
              >
                {detail.amountSign}
                {Math.abs(entry.amount)}
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
