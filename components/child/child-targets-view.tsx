"use client";

import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { useChildTargetsData } from "@/lib/hooks/use-child-targets-data";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { ChildFetchingIndicator } from "@/components/shared/child-fetching-indicator";
import { AnimatePresence, m } from "@/lib/motion";
import { ChildMotionRoot } from "@/components/child/child-motion-root";
import {
  Target,
  Gift,
  Award,
  Zap,
  Sparkles,
  Trophy,
  History,
  TrendingUp,
  Heart,
  ChevronRight,
  Flame,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Goal } from "@/types/database";
import { GoalVisualStateBadge } from "@/components/shared/goal-visual-state-badge";
import { getGoalVisualStateMeta } from "@/lib/goals/visual-state";
import { cn } from "@/lib/utils";
import { ChildGoalClaimPanel } from "@/components/child/child-goal-claim-panel";

export function ChildTargetsView() {
  const { profileId } = useChildModeStore();
  const { data, isLoading, isFetching } = useChildTargetsData(profileId);

  if (!profileId || (isLoading && !data)) {
    return <PageLoadingSkeleton variant="child" className="min-h-[50vh]" />;
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-center text-sm text-emerald-800">
        Gagal memuat target. Coba refresh halaman.
      </div>
    );
  }

  const { goals, totalPoints, goalSaveEnabled } = data;
  const activeGoals = goals.filter((g) => g.status === "active");
  const readyToClaimGoals = goals.filter((g) => g.status === "ready_to_claim");
  const completedGoals = goals.filter((g) => g.status === "completed");
  const archivedGoals = goals.filter((g) => g.status === "archived");

  return (
    <ChildMotionRoot>
    <div className="relative space-y-6" data-fetching={isFetching ? "" : undefined}>
      <ChildFetchingIndicator isFetching={isFetching && !!data} />
      {/* 1. Header Area */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-none mb-1">
            Target & Hadiahku 🎁
          </h2>
          <p className="text-xs text-muted-foreground">
            Kumpulkan poin energi dari misimu untuk menebus hadiah impian!
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-2xl bg-amber-50 border border-amber-200/50 px-3 py-1.5 shadow-sm">
          <Zap className="h-4 w-4 text-amber-500 fill-amber-500 animate-pulse shrink-0" />
          <span className="text-xs font-extrabold text-amber-950">{totalPoints} E</span>
        </div>
      </div>

      {readyToClaimGoals.length > 0 ? (
        <div className="space-y-3">
          <h3 className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wider text-emerald-600">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Siap Dipilih!
          </h3>
          {readyToClaimGoals.map((goal) => (
            <Card key={goal.id} className="overflow-hidden border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white shadow-md">
              <CardContent className="space-y-3 p-5">
                <div>
                  <h4 className="font-heading text-sm font-black text-slate-900">{goal.title}</h4>
                  <p className="text-xs text-emerald-800">
                    {goal.current_hp}/{goal.target_hp} energi terkumpul — pilih langkah selanjutnya:
                  </p>
                </div>
                <ChildGoalClaimPanel goal={goal} goalSaveEnabled={goalSaveEnabled} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* 2. Active Target Progress Card */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-emerald-600" />
          Target Aktif Saat Ini
        </h3>

        {activeGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-dashed border-slate-200 bg-white/40 backdrop-blur-sm space-y-3">
            <Trophy className="h-8 w-8 text-slate-300" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-700">Belum Ada Target Aktif</h4>
              <p className="text-[10px] text-slate-400 max-w-[220px]">
                Bicarakan dengan Papa atau Mama untuk memilih satu target hadiah aktif agar energimu mulai terkumpul!
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {activeGoals.map((goal) => {
              const progress = Math.min(100, (goal.current_hp / goal.target_hp) * 100);
              const isReady = goal.current_hp >= goal.target_hp;
              const visualMeta = getGoalVisualStateMeta(goal.visual_state);

              return (
                <m.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card
                    className={cn(
                      "overflow-hidden border bg-gradient-to-br from-white to-rose-50/10 shadow-md rounded-3xl relative",
                      visualMeta.cardClass,
                    )}
                  >
                    {isReady && (
                      <div className="absolute top-2 right-2">
                        <m.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold border-none text-[9px] px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                            <Sparkles className="h-2.5 w-2.5 fill-white" />
                            SIAP KLAIM!
                          </Badge>
                        </m.div>
                      </div>
                    )}
                    <CardContent className="p-5 space-y-4">
                      <div className="flex gap-3 items-start">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                          isReady ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        } shadow-inner`}>
                          <Gift className="h-6 w-6 animate-pulse" />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <h4 className="text-sm font-black text-slate-900 leading-snug truncate">
                            {goal.title}
                          </h4>
                          <GoalVisualStateBadge
                            state={goal.visual_state}
                            showHint={goal.visual_state !== "fresh"}
                          />
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              Target Hadiah
                            </span>
                            <span className="text-[8px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.2 rounded-full border border-rose-100/50">
                              Petualangan
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar & Numerical values */}
                      <div className="space-y-2 rounded-2xl bg-slate-50/50 border border-slate-100 p-3">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                          <span className="flex items-center gap-0.5">
                            <TrendingUp className="h-3 w-3 text-slate-400" />
                            Progres Energi
                          </span>
                          <span className={`${isReady ? "text-emerald-700 font-black" : "text-rose-700 font-extrabold"}`}>
                            {goal.current_hp} / {goal.target_hp} HP ({Math.round(progress)}%)
                          </span>
                        </div>

                        <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r ${
                              isReady
                                ? "from-emerald-500 to-teal-400 shadow-md"
                                : "from-rose-500 to-pink-500"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <span className="text-[9px] text-slate-400 block italic leading-none">
                          {isReady
                            ? "Keren! Tunjukkan ini ke Papa/Mama untuk ditukarkan hadiah aslinya! 🎉"
                            : `${goal.target_hp - goal.current_hp} HP energi lagi untuk menebus target ini.`}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </m.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Garden of Completed Targets (Kebun Energi) */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
          Kebun Energiku (Hadiah yang Pernah Dicapai)
        </h3>

        {completedGoals.length === 0 ? (
          <div className="text-center py-6 rounded-3xl border border-dashed border-slate-200 bg-white/40 backdrop-blur-sm text-slate-400 text-[10px] p-4">
            Kamu belum pernah menuntaskan target hadiah sebelumnya. Semangat kumpulkan energi untuk melengkapi piala pertamamu!
          </div>
        ) : (
          <div className="grid gap-2.5">
            {completedGoals.map((goal) => (
              <Card
                key={goal.id}
                className="border border-emerald-100 bg-emerald-50/10 rounded-2xl overflow-hidden"
              >
                <CardContent className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-xs text-slate-900 leading-snug truncate max-w-[180px]">
                        {goal.title}
                      </h4>
                      <p className="text-[9px] text-emerald-700/80 font-bold flex items-center gap-0.5 leading-none">
                        <Sparkles className="h-2.5 w-2.5 fill-emerald-100" />
                        Telah Berhasil Ditebus!
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100/60 rounded-lg px-2.5 py-1 text-[10px]">
                    🏆 {goal.target_hp} HP
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 4. Pending / Archived Goals (Daftar Impian) */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5 text-violet-500 fill-violet-50" />
          Daftar Impian Berikutnya ({archivedGoals.length})
        </h3>

        {archivedGoals.length === 0 ? (
          <div className="text-center py-5 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-[10px] bg-slate-50/20">
            Tidak ada target cadangan yang disiapkan.
          </div>
        ) : (
          <div className="grid gap-2">
            {archivedGoals.map((goal) => (
              <Card
                key={goal.id}
                className="border border-slate-150 bg-white/80 rounded-xl"
              >
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Gift className="h-4 w-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-700 text-xs block leading-none mb-1 truncate">
                        {goal.title}
                      </span>
                      <span className="text-[9px] text-slate-400 block font-semibold leading-none">
                        Dibutuhkan: {goal.target_hp} HP energi
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-slate-50 text-slate-500 hover:bg-slate-50 border-slate-200 text-[9px] font-bold">
                    Antrean
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
    </ChildMotionRoot>
  );
}
