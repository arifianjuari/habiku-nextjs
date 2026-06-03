"use client";

import { Clock } from "lucide-react";
import type { GoalCountdownRow } from "@/lib/child/engagement-types";

type ChildGoalCountdownRowProps = {
  rows: GoalCountdownRow[];
};

export function ChildGoalCountdownRow({ rows }: ChildGoalCountdownRowProps) {
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" aria-label="Estimasi hari menuju target">
      {rows.map((row) => {
        const daysLabel =
          row.daysLeft >= 9999
            ? "Terus semangat!"
            : row.daysLeft <= 0
              ? "Hampir sampai!"
              : `~${row.daysLeft} hari lagi`;

        return (
          <span
            key={row.goalId}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
              row.nearDeadline
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-slate-200 bg-white/80 text-slate-700"
            }`}
          >
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate max-w-[140px]">{row.title}</span>
            <span className="opacity-80">· {daysLabel}</span>
          </span>
        );
      })}
    </div>
  );
}
