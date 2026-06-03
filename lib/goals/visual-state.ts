import type { GoalVisualState } from "@/lib/database/enums";

export type GoalVisualStateMeta = {
  label: string;
  shortHint: string;
  badgeClass: string;
  cardClass: string;
};

const META: Record<GoalVisualState, GoalVisualStateMeta> = {
  fresh: {
    label: "Segar",
    shortHint: "Target bersemangat — anak konsisten menyelesaikan misi.",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cardClass: "border-emerald-100",
  },
  slightly_wilted: {
    label: "Sedikit Layu",
    shortHint: "1 hari tanpa misi selesai — ajak anak kembali ke rutinitas.",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-200",
    cardClass: "border-amber-200 bg-amber-50/20",
  },
  wilted: {
    label: "Layu",
    shortHint: "2+ hari tanpa misi — perjanjian keluarga: dukung tanpa menghukum.",
    badgeClass: "bg-orange-100 text-orange-900 border-orange-200",
    cardClass: "border-orange-200 bg-orange-50/25 opacity-95",
  },
  dormant: {
    label: "Istirahat",
    shortHint: "Target diarsipkan atau tidak aktif untuk sementara.",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    cardClass: "border-slate-200 bg-slate-50/40",
  },
};

export function getGoalVisualStateMeta(
  state: GoalVisualState | string | null | undefined,
): GoalVisualStateMeta {
  if (state && state in META) {
    return META[state as GoalVisualState];
  }
  return META.fresh;
}
