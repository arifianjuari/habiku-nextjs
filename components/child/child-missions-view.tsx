"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import {
  BookOpen,
  GraduationCap,
  Sparkles,
  Dumbbell,
  Trash2,
  Droplet,
  CheckCircle,
  Clock,
  Zap,
  HelpCircle,
  ChevronRight,
  Flame,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Task, TaskHistory } from "@/types/database";

interface TaskWithStatus extends Task {
  submissionsToday: number;
  isCompletedToday: boolean;
  isPendingToday: boolean;
  isFeatured?: boolean;
  featuredMultiplierText?: string;
  featuredMultiplierValue?: number;
}

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
  const { profileId, profileName } = useChildModeStore();
  const [tasks, setTasks] = useState<TaskWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    if (!profileId) return;
    const activeProfileId = profileId;

    // Guard: Pastikan profileId adalah UUID yang valid untuk mencegah Postgres 22P02 error
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(activeProfileId)) {
      console.warn("⚠️ Invalid profileId UUID format:", activeProfileId);
      setTasks([]);
      setLoading(false);
      return;
    }

    async function loadMissions() {
      try {
        setLoading(true);

        // 1. Fetch active tasks for profileId
        const { data: fetchedTasks, error: tasksError } = await supabase
          .from("tasks")
          .select("*")
          .eq("profile_id", activeProfileId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (tasksError) throw tasksError;

        // 2. Fetch today's submissions for this child
        const todayStr = new Date(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
        )
          .toISOString()
          .split("T")[0];

        const { data: todayHistory, error: historyError } = await supabase
          .from("task_history")
          .select("id, task_id, status")
          .eq("profile_id", activeProfileId)
          .eq("period_date", todayStr);

        if (historyError) throw historyError;

        // 3. Fetch active computed featured task for the child
        const { data: featuredData, error: featuredError } = await (supabase as any)
          .rpc("compute_featured_task", { p_profile_id: activeProfileId });

        const featuredTask = featuredData && featuredData.length > 0 ? featuredData[0] : null;

        // 4. Map status & featured status to tasks
        const mappedTasks = (fetchedTasks || []).map((task: any) => {
          const submissions = todayHistory?.filter((h) => h.task_id === task.id) || [];
          const isCompleted = submissions.some((h) => h.status === "approved");
          const isPending = submissions.some((h) => h.status === "pending");
          const isFeatured = featuredTask && featuredTask.task_id === task.id;

          return {
            ...task,
            submissionsToday: submissions.length,
            isCompletedToday: isCompleted,
            isPendingToday: isPending,
            isFeatured: !!isFeatured,
            featuredMultiplierText: isFeatured ? featuredTask.multiplier_text : undefined,
            featuredMultiplierValue: isFeatured ? Number(featuredTask.multiplier_value) : undefined,
          };
        });

        setTasks(mappedTasks);
      } catch (err: any) {
        console.error("Error loading child missions details:", {
          message: err?.message,
          code: err?.code,
          details: err?.details,
          hint: err?.hint,
          error: err,
        });
      } finally {
        setLoading(false);
      }
    }

    loadMissions();
  }, [profileId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <span className="text-xs font-semibold text-emerald-800">Menyiapkan Misi Kamu…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-black text-slate-900 tracking-tight leading-none">
          Misi Harian Kamu 🎯
        </h2>
        <p className="text-xs font-medium text-slate-500">
          Selesaikan misi harian di bawah ini untuk mendapatkan energi!
        </p>
      </div>

      {/* Missions Grid */}
      {tasks.length === 0 ? (
        <Card className="border border-dashed border-slate-200 bg-white/40 backdrop-blur-sm rounded-3xl p-8 text-center flex flex-col items-center justify-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-700">Misi Masih Kosong</h4>
            <p className="text-[10px] text-slate-400 max-w-[220px]">
              Minta Papa atau Mama untuk menambahkan misi baru di dasbor orang tua ya!
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => {
            const config = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.lainnya;
            const Icon = config.icon;

            // Determine if the child has reached max submissions today
            const isLimitReached = task.submissionsToday >= task.max_submissions_per_period;
            
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                className="group relative"
              >
                <Card className={`overflow-hidden border backdrop-blur-md rounded-3xl shadow-sm group-hover:shadow-md transition-all duration-300 ${
                  task.isFeatured
                    ? "border-amber-300 bg-gradient-to-br from-amber-50/70 via-white/95 to-yellow-50/60 shadow-amber-100 ring-2 ring-amber-400/10"
                    : `${config.border} ${config.bgLight}`
                }`}>
                  {/* Category Accent Badge at Top-Right */}
                  <div className={`absolute top-4 right-4 flex items-center gap-1 bg-white border rounded-full px-2.5 py-1 shadow-sm ${
                    task.isFeatured 
                      ? "border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 font-extrabold shadow-amber-100 ring-2 ring-amber-400/20" 
                      : "border-slate-100 bg-white/80"
                  }`}>
                    <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                    <span className="text-[10px] font-black">
                      +{task.isFeatured && task.featuredMultiplierValue 
                        ? Math.round(task.reward_points * task.featuredMultiplierValue) 
                        : task.reward_points
                      } E
                    </span>
                    {task.isFeatured && (
                      <span className="ml-0.5 text-[8px] px-1 bg-amber-500 text-white rounded-md font-black uppercase tracking-tight">
                        {task.featuredMultiplierText}
                      </span>
                    )}
                  </div>

                  <CardContent className="p-4 space-y-4">
                    {/* Mission Header */}
                    <div className="flex gap-3 items-start pr-14">
                      {/* Round icon with category gradient */}
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white bg-gradient-to-br ${config.gradient} shadow-md`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`text-[9px] font-extrabold tracking-wider uppercase ${config.color}`}>
                            {config.label}
                          </span>
                          {task.isFeatured && (
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wide bg-amber-500 text-white px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                              ⭐ Sorotan Papa & Mama
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-sm text-slate-900 leading-snug group-hover:text-slate-950">
                          {task.title}
                        </h3>
                        {task.frequency_type && (
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-semibold">
                            <span className="capitalize">Rutinitas: {task.frequency_type}</span>
                            <span>•</span>
                            <span>Maksimal: {task.max_submissions_per_period}x / hari</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mission Footer / Actions */}
                    <div className="border-t border-slate-100/55 pt-3 flex items-center justify-between">
                      {/* Completed / Active Status tag */}
                      <div>
                        {task.isCompletedToday ? (
                          <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5 text-[9px] font-bold">
                            <CheckCircle className="h-3 w-3 fill-emerald-100" />
                            <span>Selesai Hari Ini! 🎉</span>
                          </div>
                        ) : task.isPendingToday ? (
                          <div className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-0.5 text-[9px] font-bold">
                            <Clock className="h-3 w-3" />
                            <span>Menunggu Review Ortu ⏳</span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-400 font-semibold">
                            Belum dikerjakan hari ini
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      {isLimitReached ? (
                        <Button
                          disabled
                          className="bg-slate-100 border border-slate-200 text-slate-400 rounded-xl h-8 text-[10px] font-extrabold px-3"
                        >
                          Misi Selesai
                        </Button>
                      ) : (
                        <Link href={`/child/missions/${task.id}`} passHref>
                          <Button
                            className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl h-8 text-[10px] font-extrabold px-3.5 shadow-sm shadow-emerald-700/10 cursor-pointer flex items-center gap-1"
                          >
                            <span>Kerjakan Misi</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
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
