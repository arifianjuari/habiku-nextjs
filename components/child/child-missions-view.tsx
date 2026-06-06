"use client";

import { useState } from "react";
import Link from "next/link";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { useChildMissionsData } from "@/lib/hooks/use-child-missions-data";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { ChildMissionRequestDialog } from "@/components/child/child-mission-request-dialog";
import { motion } from "framer-motion";
import {
  BookOpen,
  GraduationCap,
  Sparkles,
  Dumbbell,
  Droplet,
  CheckCircle,
  Clock,
  Zap,
  HelpCircle,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  formatMaxSubmissionsLabel,
  getFrequencyDisplayLabel,
  normalizeFrequencyForParentForm,
} from "@/lib/tasks/mission-frequency";
const CATEGORY_CONFIG: Record<
  string,
  {
    label: string;
    icon: any;
    color: string;
    bgLight: string;
    border: string;
    gradient: string;
  }
> = {
  ibadah: {
    label: "Ibadah",
    icon: Sparkles,
    color: "text-violet-600",
    bgLight: "bg-violet-50/80",
    border: "border-violet-100",
    gradient: "from-violet-500 to-indigo-600",
  },
  belajar: {
    label: "Belajar",
    icon: GraduationCap,
    color: "text-amber-600",
    bgLight: "bg-amber-50/80",
    border: "border-amber-100",
    gradient: "from-amber-400 to-orange-500",
  },
  kebersihan: {
    label: "Kebersihan",
    icon: Droplet,
    color: "text-cyan-600",
    bgLight: "bg-cyan-50/80",
    border: "border-cyan-100",
    gradient: "from-cyan-400 to-blue-500",
  },
  olahraga: {
    label: "Olahraga",
    icon: Dumbbell,
    color: "text-emerald-600",
    bgLight: "bg-emerald-50/80",
    border: "border-emerald-100",
    gradient: "from-emerald-400 to-teal-500",
  },
  lainnya: {
    label: "Lainnya",
    icon: HelpCircle,
    color: "text-slate-600",
    bgLight: "bg-slate-50/80",
    border: "border-slate-100",
    gradient: "from-slate-400 to-slate-600",
  },
};

export function ChildMissionsView() {
  const { profileId } = useChildModeStore();
  const { data, isLoading, isFetching } = useChildMissionsData(profileId);
  const [requestOpen, setRequestOpen] = useState(false);

  const tasks = data?.tasks ?? [];
  const pendingRequests = data?.pendingRequests ?? [];

  if (!profileId || (isLoading && tasks.length === 0 && pendingRequests.length === 0)) {
    return <PageLoadingSkeleton variant="child" className="min-h-[50vh]" />;
  }

  return (
    <div className="space-y-4" data-fetching={isFetching ? "" : undefined}>
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-black text-slate-900 tracking-tight leading-none">
            Misi Harian Kamu 🎯
          </h2>
          <p className="text-xs font-medium text-slate-500">
            Selesaikan misi harian di bawah ini untuk mendapatkan energi!
          </p>
        </div>
        <Button
          type="button"
          size="xs"
          onClick={() => setRequestOpen(true)}
          className="shrink-0 rounded-lg bg-amber-500 font-bold text-white hover:bg-amber-600"
        >
          <Lightbulb className="mr-1 h-3.5 w-3.5" aria-hidden />
          Ajukan
        </Button>
      </div>

      {pendingRequests.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[9px] font-extrabold uppercase tracking-wide text-amber-700">
            Menunggu ortu ({pendingRequests.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {pendingRequests.map((request) => {
              const freqType = request.requested_frequency_type ?? "daily";
              const meta = `${getFrequencyDisplayLabel(freqType)} · ${formatMaxSubmissionsLabel(
                request.requested_max_submissions_per_period ?? 1,
                normalizeFrequencyForParentForm(freqType),
              )}${request.note ? ` · ${request.note}` : ""}`;

              return (
                <Card
                  key={request.id}
                  className="!gap-0 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/90 !py-0 shadow-sm"
                >
                  <CardContent className="!px-2.5 !py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500 text-white">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1 leading-none">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="truncate text-[13px] font-bold text-slate-900">
                            {request.title}
                          </p>
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-black text-amber-800">
                            <Zap className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                            +{request.requested_reward_points}E
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[9px] font-medium text-amber-800/90">
                          {meta}
                        </p>
                        <p className="mt-0.5 text-[8px] font-semibold text-amber-600">
                          Menunggu persetujuan ortu
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      <ChildMissionRequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        profileId={profileId}
      />

      {/* Missions Grid */}
      {tasks.length === 0 ? (
        <Card
          size="sm"
          className="flex flex-col items-center justify-center space-y-2.5 rounded-3xl border border-dashed border-slate-200 bg-white/40 py-0 text-center backdrop-blur-sm"
        >
          <CardContent className="flex flex-col items-center space-y-2.5 p-5">
          <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-700">Misi Masih Kosong</h4>
            <p className="text-[10px] text-slate-400 max-w-[220px]">
              Minta Papa atau Mama untuk menambahkan misi baru di dasbor orang tua ya!
            </p>
          </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => {
            const config = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.lainnya;
            const Icon = config.icon;
            const rewardPoints =
              task.isFeatured && task.featuredMultiplierValue
                ? Math.round(task.reward_points * task.featuredMultiplierValue)
                : task.reward_points;
            const isLimitReached = task.submissionsToday >= task.max_submissions_per_period;
            const frequencyLabel = task.frequency_type
              ? `${getFrequencyDisplayLabel(task.frequency_type)} · ${formatMaxSubmissionsLabel(task.max_submissions_per_period, task.frequency_type)}`
              : null;

            const statusLabel = task.isCompletedToday
              ? "Selesai 🎉"
              : task.isPendingToday
                ? "Review ortu"
                : "Belum dikerjakan";

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className={`!gap-0 overflow-hidden rounded-xl border !py-0 shadow-sm ${
                    task.isFeatured
                      ? "border-amber-300 bg-gradient-to-br from-amber-50/80 to-white ring-1 ring-amber-400/15"
                      : `${config.border} ${config.bgLight}`
                  }`}
                >
                  <CardContent className="!px-2.5 !py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white ${config.gradient}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      <div className="min-w-0 flex-1 leading-none">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="truncate text-[13px] font-bold text-slate-900">
                            {task.title}
                          </p>
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-black text-amber-700">
                            <Zap className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                            +{rewardPoints}E
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[9px] font-medium text-slate-500">
                          <span className={config.color}>{config.label}</span>
                          {frequencyLabel ? ` · ${frequencyLabel}` : null}
                          {task.isFeatured ? " · ⭐ Sorotan" : null}
                        </p>
                        <p
                          className={`mt-0.5 truncate text-[8px] font-semibold ${
                            task.isCompletedToday
                              ? "text-emerald-600"
                              : task.isPendingToday
                                ? "text-amber-600"
                                : "text-slate-400"
                          }`}
                        >
                          {task.isCompletedToday ? (
                            <span className="inline-flex items-center gap-0.5">
                              <CheckCircle className="h-2.5 w-2.5" />
                              {statusLabel}
                            </span>
                          ) : task.isPendingToday ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {statusLabel}
                            </span>
                          ) : (
                            statusLabel
                          )}
                        </p>
                      </div>

                      <div className="shrink-0 self-center">
                        {isLimitReached ? (
                          <Button
                            size="xs"
                            disabled
                            variant="secondary"
                            className="h-6 min-h-0 rounded-md px-2 text-[9px] font-bold text-slate-400"
                          >
                            Selesai
                          </Button>
                        ) : (
                          <Link
                            href={`/child/missions/${task.id}`}
                            className="inline-flex"
                          >
                            <Button
                              size="xs"
                              className="h-6 min-h-0 rounded-md bg-emerald-700 px-2 text-[9px] font-bold text-white hover:bg-emerald-800"
                            >
                              Kerjakan
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
