"use client";

import { useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  PlusCircle,
  Trash2,
  BookOpen,
  GraduationCap,
  Sparkles,
  Activity,
  HelpCircle,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChildAvatar } from "@/components/shared/child-avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { createTask, toggleTaskStatus, deleteTask, setChildFeaturedTaskAction } from "@/app/parent/tasks/actions";
import type { ChildProfile, Task } from "@/types/database";

interface TasksClientViewProps {
  children: ChildProfile[];
  initialTasks: Task[];
}

const CATEGORY_STYLES = {
  ibadah: {
    bg: "bg-violet-50/50 hover:bg-violet-50/80 border-violet-100",
    iconBg: "bg-violet-500",
    text: "text-violet-700",
    label: "Ibadah",
    icon: BookOpen,
  },
  belajar: {
    bg: "bg-blue-50/50 hover:bg-blue-50/80 border-blue-100",
    iconBg: "bg-blue-500",
    text: "text-blue-700",
    label: "Belajar",
    icon: GraduationCap,
  },
  kebersihan: {
    bg: "bg-emerald-50/50 hover:bg-emerald-50/80 border-emerald-100",
    iconBg: "bg-emerald-500",
    text: "text-emerald-700",
    label: "Kebersihan",
    icon: Sparkles,
  },
  olahraga: {
    bg: "bg-amber-50/50 hover:bg-amber-50/80 border-amber-100",
    iconBg: "bg-amber-500",
    text: "text-amber-700",
    label: "Olahraga",
    icon: Activity,
  },
  lainnya: {
    bg: "bg-slate-50/50 hover:bg-slate-50/80 border-slate-200",
    iconBg: "bg-slate-500",
    text: "text-slate-700",
    label: "Lainnya",
    icon: HelpCircle,
  },
};

const FREQUENCY_LABELS = {
  daily: "Setiap Hari",
  weekly: "Setiap Minggu",
  custom: "Kustom",
};

export function TasksClientView({ children, initialTasks }: TasksClientViewProps) {
  const [activeChildId, setActiveChildId] = useState<string>(
    children[0]?.id || ""
  );
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [profiles, setProfiles] = useState<ChildProfile[]>(children);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Create Form States
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<keyof typeof CATEGORY_STYLES>("lainnya");
  const [rewardPoints, setRewardPoints] = useState("10");
  const [frequencyType, setFrequencyType] = useState<"daily" | "weekly" | "custom">("daily");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setProfiles(children);
  }, [children]);

  const activeChild = profiles.find((c) => c.id === activeChildId);
  const childTasks = tasks.filter((t) => t.profile_id === activeChildId);

  const handleToggleFeatured = (taskId: string, isCurrentlyFeatured: boolean) => {
    if (!activeChildId) return;

    const targetTaskId = isCurrentlyFeatured ? null : taskId;

    // Optimistically update local profile state
    setProfiles((prev) =>
      prev.map((c) =>
        c.id === activeChildId ? { ...c, featured_task_id: targetTaskId } : c
      )
    );

    startTransition(async () => {
      const res = await setChildFeaturedTaskAction(activeChildId, targetTaskId);
      if (res?.error) {
        // Rollback
        setProfiles(children);
        toast.error(res.error);
      } else {
        toast.success(
          isCurrentlyFeatured
            ? "Misi sorotan berhasil dilepas."
            : "Misi berhasil disematkan sebagai Sorotan Utama! 🌟"
        );
      }
    });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const formData = new FormData();
    formData.set("childId", activeChildId);
    formData.set("title", title);
    formData.set("category", category);
    formData.set("rewardPoints", rewardPoints);
    formData.set("frequencyType", frequencyType);

    startTransition(async () => {
      const res = await createTask(null, formData);
      if (res?.error) {
        setFormError(res.error);
        toast.error(res.error);
      } else if (res?.success && res.task) {
        setTasks((prev) => [res.task as Task, ...prev]);
        toast.success("Misi harian berhasil ditambahkan! 🌟");
        
        // Reset states
        setTitle("");
        setCategory("lainnya");
        setRewardPoints("10");
        setFrequencyType("daily");
        setIsOpen(false);
      }
    });
  };

  const handleToggleActive = (taskId: string, currentStatus: boolean) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, is_active: !currentStatus } : t))
    );

    startTransition(async () => {
      const res = await toggleTaskStatus(taskId, currentStatus);
      if (res?.error) {
        // Rollback on error
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, is_active: currentStatus } : t))
        );
        toast.error(res.error);
      } else {
        toast.success(
          currentStatus
            ? "Misi dinonaktifkan sementara."
            : "Misi diaktifkan kembali! 🔥"
        );
      }
    });
  };

  const handleDelete = (taskId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus misi ini secara permanen?")) {
      return;
    }

    const previousTasks = [...tasks];
    // Optimistic UI update
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    startTransition(async () => {
      const res = await deleteTask(taskId);
      if (res?.error) {
        // Rollback
        setTasks(previousTasks);
        toast.error(res.error);
      } else {
        toast.success("Misi berhasil dihapus.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Tab Selector Anak */}
      {profiles.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {profiles.map((child) => {
            const isSelected = child.id === activeChildId;
            const accentColor = child.home_card_accent || "#8B5CF6";
            return (
              <button
                key={child.id}
                onClick={() => setActiveChildId(child.id)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-all border shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-white text-slate-900 shadow-md font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                }`}
                style={isSelected ? { borderColor: `${accentColor}50` } : {}}
              >
                <ChildAvatar
                  name={child.name}
                  avatarUrl={child.avatar_url}
                  avatarPreference={child.avatar_preference}
                  avatarEmoji={child.avatar_emoji}
                  accentColor={accentColor}
                  className="h-6 w-6 shrink-0 rounded-lg shadow-sm"
                  fallbackSizeClass="text-[10px]"
                />
                <span>{child.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Header Dashboard Misi */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Daftar Misi {activeChild?.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            Kelola misi rutin, poin, dan frekuensi tugas harian.
          </p>
        </div>

        {/* Dialog untuk Tambah Misi Baru */}
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); setFormError(null); }}>
          <DialogTrigger
            className="group/button inline-flex shrink-0 items-center justify-center rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold h-9 px-3.5 shadow-md shadow-violet-950/10 cursor-pointer select-none outline-none text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Tambah Misi
          </DialogTrigger>
          <DialogContent className="max-w-sm rounded-3xl border border-violet-100 bg-white/95 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg font-bold text-center flex items-center justify-center gap-2 text-slate-900">
                <PlusCircle className="h-5 w-5 text-violet-700" />
                Misi Baru untuk {activeChild?.name}
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-slate-500">
                Buat misi rutin baru yang mendidik dan seru.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-bold text-slate-800">Nama Misi</Label>
                <Input
                  id="title"
                  placeholder="Misal: Merapikan Kasur, Shalat Subuh"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-violet-100 focus-visible:ring-violet-700 h-10 rounded-xl bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rewardPoints" className="text-xs font-bold text-slate-800">Poin Reward</Label>
                  <Input
                    id="rewardPoints"
                    type="number"
                    min="1"
                    value={rewardPoints}
                    onChange={(e) => setRewardPoints(e.target.value)}
                    className="border-violet-100 focus-visible:ring-violet-700 h-10 rounded-xl bg-white"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="frequencyType" className="text-xs font-bold text-slate-800">Frekuensi</Label>
                  <select
                    id="frequencyType"
                    value={frequencyType}
                    onChange={(e: any) => setFrequencyType(e.target.value)}
                    className="flex w-full rounded-xl border border-violet-100 bg-white px-3 h-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-700 focus:border-transparent"
                  >
                    <option value="daily">Setiap Hari</option>
                    <option value="weekly">Setiap Minggu</option>
                    <option value="custom">Kustom</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800">Kategori Misi</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(CATEGORY_STYLES) as Array<keyof typeof CATEGORY_STYLES>).map((cat) => {
                    const style = CATEGORY_STYLES[cat];
                    const isSelected = category === cat;
                    const Icon = style.icon;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? `${style.bg} border-violet-500 font-bold ring-2 ring-violet-500/20`
                            : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Icon className={`h-4.5 w-4.5 mb-1 ${isSelected ? style.text : "text-slate-400"}`} />
                        <span className="text-[10px] capitalize leading-none">{style.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {formError && (
                <p className="text-xs font-semibold text-red-600 text-center bg-red-50 p-2.5 rounded-lg border border-red-100" role="alert">
                  {formError}
                </p>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-violet-700 hover:bg-violet-800 text-white font-bold h-11 rounded-xl shadow-md"
                >
                  {isPending ? "Menyimpan Misi..." : "Simpan Misi Baru"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 3. Grid Daftar Misi */}
      <AnimatePresence mode="wait">
        {childTasks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center p-8 text-center rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 backdrop-blur-sm space-y-4"
          >
            <div className="rounded-full bg-slate-100 p-4">
              <Calendar className="h-8 w-8 text-slate-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">Belum Ada Misi Terdaftar</h3>
              <p className="text-xs text-slate-500 max-w-[240px]">
                Buat misi pertama untuk {activeChild?.name} agar dapat mengumpulkan energi dan menukarkan hadiah!
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-3"
          >
            {childTasks.map((task) => {
              const style = CATEGORY_STYLES[task.category] || CATEGORY_STYLES.lainnya;
              const Icon = style.icon;
              return (
                <motion.div
                  key={task.id}
                  layout
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 ${
                    task.is_active ? "opacity-100" : "opacity-60 bg-slate-50"
                  } ${
                    activeChild?.featured_task_id === task.id && task.is_active
                      ? "border-amber-400 ring-2 ring-amber-400/20 shadow-md shadow-amber-100 bg-gradient-to-r from-amber-50/20 via-white to-white"
                      : ""
                  }`}
                  style={{ borderColor: task.is_active && activeChild?.featured_task_id !== task.id ? undefined : activeChild?.featured_task_id === task.id && task.is_active ? "#FBBF24" : "#E2E8F0" }}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    {/* Category Icon & Info */}
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${style.iconBg} shadow-sm`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className={`font-semibold text-sm ${task.is_active ? "text-slate-900" : "text-slate-500 line-through"}`}>
                          {task.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                          <span className={`font-semibold capitalize ${style.text}`}>
                            {style.label}
                          </span>
                          {activeChild?.featured_task_id === task.id && task.is_active && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-0.5 font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded-md border border-amber-200/50">
                                ⭐ Sorotan
                              </span>
                            </>
                          )}
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {FREQUENCY_LABELS[task.frequency_type as keyof typeof FREQUENCY_LABELS] || "Rutin"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Controls & Points */}
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Tombol Misi Sorotan (Hanya jika misi aktif) */}
                      {task.is_active && (
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(task.id, activeChild?.featured_task_id === task.id)}
                          className={`h-8 w-8 flex items-center justify-center rounded-xl transition-all border cursor-pointer ${
                            activeChild?.featured_task_id === task.id
                              ? "bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/20 hover:bg-amber-600 scale-105"
                              : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-amber-50 hover:text-amber-500 hover:border-amber-200"
                          }`}
                          title={
                            activeChild?.featured_task_id === task.id
                              ? "Lepas Misi Sorotan"
                              : "Jadikan Misi Sorotan Utama (2x Energi)"
                          }
                        >
                          <Star
                            className={`h-4.5 w-4.5 ${
                              activeChild?.featured_task_id === task.id ? "fill-white" : ""
                            }`}
                          />
                        </button>
                      )}

                      {/* Poin Reward */}
                      <div className="flex items-center gap-1 rounded-xl bg-amber-50 border border-amber-200/50 px-2 py-1 shadow-sm">
                        <span className="text-xs font-extrabold text-amber-950">+{task.reward_points} E</span>
                      </div>

                      {/* Action Menu (Toggle & Delete) */}
                      <div className="flex items-center gap-1.5">
                        {/* Switch Aktif / Nonaktif */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(task.id, task.is_active)}
                          className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            task.is_active ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                          aria-label="Aktifkan Misi"
                        >
                          <span
                            className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              task.is_active ? "translate-x-4.5" : "translate-x-0"
                            }`}
                          />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-lg border border-red-100 hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                          title="Hapus Misi"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
