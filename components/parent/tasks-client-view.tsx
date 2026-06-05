"use client";

import { useState, useTransition, useEffect, type ChangeEvent, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  PlusCircle,
  Pencil,
  Trash2,
  BookOpen,
  GraduationCap,
  Sparkles,
  Activity,
  HelpCircle,
  Calendar,
  Clock,
  Plus,
  Star,
  Zap,
} from "lucide-react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createTask,
  updateTask,
  toggleTaskStatus,
  deleteTask,
  setChildFeaturedTaskAction,
} from "@/app/parent/tasks/actions";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { cn } from "@/lib/utils";
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

function TaskActiveSwitch({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      data-compact
      onClick={onToggle}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none",
        active ? "justify-end bg-emerald-500" : "justify-start bg-slate-300",
      )}
      aria-label={active ? "Nonaktifkan misi" : "Aktifkan misi"}
    >
      <span
        aria-hidden
        className="block h-4 w-4 shrink-0 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

export function TasksClientView({ children, initialTasks }: TasksClientViewProps) {
  const [activeChildId, setActiveChildId] = useState<string>(
    children[0]?.id || ""
  );
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [profiles, setProfiles] = useState<ChildProfile[]>(children);
  const [isOpen, setIsOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<keyof typeof CATEGORY_STYLES>("lainnya");
  const [rewardPoints, setRewardPoints] = useState("10");
  const [frequencyType, setFrequencyType] = useState<"daily" | "weekly" | "custom">("daily");
  const [formError, setFormError] = useState<string | null>(null);

  const isEditMode = editingTaskId !== null;

  const resetForm = () => {
    setEditingTaskId(null);
    setTitle("");
    setCategory("lainnya");
    setRewardPoints("10");
    setFrequencyType("daily");
    setFormError(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setCategory(
      (task.category in CATEGORY_STYLES ? task.category : "lainnya") as keyof typeof CATEGORY_STYLES,
    );
    setRewardPoints(String(task.reward_points));
    setFrequencyType(
      (task.frequency_type === "weekly" || task.frequency_type === "custom"
        ? task.frequency_type
        : "daily") as "daily" | "weekly" | "custom",
    );
    setFormError(null);
    setIsOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

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

  const handleSubmitTask = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const formData = new FormData();
    formData.set("title", title);
    formData.set("category", category);
    formData.set("rewardPoints", rewardPoints);
    formData.set("frequencyType", frequencyType);

    startTransition(async () => {
      if (isEditMode && editingTaskId) {
        formData.set("taskId", editingTaskId);
        const res = await updateTask(null, formData);
        if (res?.error) {
          setFormError(res.error);
          toast.error(res.error);
        } else if (res?.success && res.task) {
          setTasks((prev) =>
            prev.map((t) => (t.id === editingTaskId ? (res.task as Task) : t)),
          );
          toast.success("Misi berhasil diperbarui.");
          setIsOpen(false);
          resetForm();
        }
        return;
      }

      formData.set("childId", activeChildId);
      const res = await createTask(null, formData);
      if (res?.error) {
        setFormError(res.error);
        toast.error(res.error);
      } else if (res?.success && res.task) {
        setTasks((prev) => [res.task as Task, ...prev]);
        toast.success("Misi harian berhasil ditambahkan! 🌟");
        setIsOpen(false);
        resetForm();
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
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <div className="space-y-3 pb-12">
        <ParentPageHeaderSync
          title={`Daftar Misi ${activeChild?.name ?? ""}`.trim()}
          description="Kelola misi rutin, poin, dan frekuensi tugas harian."
        />

        {/* Tab Selector Anak */}
        {profiles.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {profiles.map((child) => {
              const isSelected = child.id === activeChildId;
              const accentColor = child.home_card_accent || "#8B5CF6";
              return (
                <button
                  key={child.id}
                  onClick={() => setActiveChildId(child.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                    isSelected
                      ? "bg-white text-slate-900 shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100",
                  )}
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

        {/* Daftar Misi */}
        <AnimatePresence mode="wait">
          {childTasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center space-y-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-8 text-center backdrop-blur-sm"
            >
              <div className="rounded-full bg-slate-100 p-3">
                <Calendar className="h-7 w-7 text-slate-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">Belum Ada Misi Terdaftar</h3>
                <p className="max-w-[220px] text-xs leading-relaxed text-slate-500">
                  Buat misi pertama untuk {activeChild?.name} agar dapat mengumpulkan energi dan menukarkan hadiah!
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid gap-2"
            >
              {childTasks.map((task) => {
                const style = CATEGORY_STYLES[task.category] || CATEGORY_STYLES.lainnya;
                const Icon = style.icon;
                const isFeatured =
                  activeChild?.featured_task_id === task.id && task.is_active;

                return (
                  <motion.div
                    key={task.id}
                    layout
                    className={cn(
                      "overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-300",
                      task.is_active ? "opacity-100" : "opacity-65 bg-slate-50",
                      isFeatured && "border-amber-300 ring-1 ring-amber-400/25",
                    )}
                  >
                    <div className="flex items-start gap-2.5 p-2.5">
                      <button
                        type="button"
                        onClick={() => openEditDialog(task)}
                        className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg text-left transition-colors hover:bg-slate-50/80 active:bg-slate-100/80 cursor-pointer"
                        aria-label={`Edit misi ${task.title}`}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
                            style.iconBg,
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <h4
                            className={cn(
                              "text-xs font-semibold leading-snug break-words [overflow-wrap:anywhere]",
                              task.is_active
                                ? "text-slate-900"
                                : "text-slate-500 line-through",
                            )}
                          >
                            {task.title}
                          </h4>

                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-amber-200/50 bg-amber-50 px-1.5 py-0.5 font-extrabold tabular-nums text-amber-950">
                              <Zap
                                className="h-2.5 w-2.5 fill-amber-400 text-amber-500"
                                aria-hidden
                              />
                              +{task.reward_points}
                            </span>
                            <span aria-hidden>·</span>
                            <span className={cn("font-semibold", style.text)}>
                              {style.label}
                            </span>
                            <span aria-hidden>·</span>
                            <span className="flex items-center gap-0.5 text-slate-500">
                              <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />
                              {FREQUENCY_LABELS[
                                task.frequency_type as keyof typeof FREQUENCY_LABELS
                              ] || "Rutin"}
                            </span>
                            {isFeatured && (
                              <>
                                <span aria-hidden>·</span>
                                <span className="inline-flex items-center gap-0.5 font-bold text-amber-600">
                                  <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" aria-hidden />
                                  Sorotan
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-1 self-center">
                        {task.is_active && (
                          <button
                            type="button"
                            data-compact
                            onClick={() => handleToggleFeatured(task.id, isFeatured)}
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-lg border transition-colors cursor-pointer",
                              isFeatured
                                ? "border-amber-300 bg-amber-50 text-amber-600"
                                : "border-slate-200 bg-slate-50 text-slate-400 hover:border-amber-200 hover:text-amber-500",
                            )}
                            title={isFeatured ? "Lepas Sorotan" : "Jadikan Sorotan"}
                            aria-label={isFeatured ? "Lepas sorotan" : "Jadikan sorotan"}
                          >
                            <Star
                              className={cn("h-3.5 w-3.5", isFeatured && "fill-amber-500 text-amber-500")}
                              aria-hidden
                            />
                          </button>
                        )}

                        <TaskActiveSwitch
                          active={task.is_active}
                          onToggle={() => handleToggleActive(task.id, task.is_active)}
                        />

                        <button
                          type="button"
                          data-compact
                          onClick={() => handleDelete(task.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-100 text-red-500 transition-colors hover:bg-red-50 cursor-pointer"
                          title="Hapus Misi"
                          aria-label="Hapus misi"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FAB Tambah Misi — mengambang di atas bottom nav */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.625rem)] z-50">
        <div className="mx-auto flex max-w-lg justify-center px-4 pointer-events-auto">
          <button
            type="button"
            data-compact
            onClick={openCreateDialog}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-violet-700 px-4 text-xs font-bold text-white shadow-lg shadow-violet-950/25 ring-1 ring-violet-600/20 transition-colors hover:bg-violet-800 cursor-pointer select-none outline-none"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Tambah Misi
          </button>
        </div>
      </div>

      <DialogContent className="max-w-sm rounded-3xl border border-violet-100 bg-white/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-bold text-center flex items-center justify-center gap-2 text-slate-900">
            {isEditMode ? (
              <>
                <Pencil className="h-5 w-5 text-violet-700" />
                Edit Misi
              </>
            ) : (
              <>
                <PlusCircle className="h-5 w-5 text-violet-700" />
                Misi Baru untuk {activeChild?.name}
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-slate-500">
            {isEditMode
              ? "Ubah nama, poin, frekuensi, atau kategori misi."
              : "Buat misi rutin baru yang mendidik dan seru."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmitTask} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-bold text-slate-800">Nama Misi</Label>
                <Input
                  id="title"
                  placeholder="Misal: Merapikan Kasur, Shalat Subuh"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 rounded-xl border-violet-100 bg-white text-sm focus-visible:ring-violet-700"
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
                    className="h-9 rounded-xl border-violet-100 bg-white text-sm focus-visible:ring-violet-700"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="frequencyType" className="text-xs font-bold text-slate-800">Frekuensi</Label>
                  <select
                    id="frequencyType"
                    value={frequencyType}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFrequencyType(e.target.value as "daily" | "weekly" | "custom")}
                    className="flex h-9 w-full rounded-xl border border-violet-100 bg-white px-3 text-sm ring-offset-background focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-700"
                  >
                    <option value="daily">Setiap Hari</option>
                    <option value="weekly">Setiap Minggu</option>
                    <option value="custom">Kustom</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800">Kategori Misi</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(CATEGORY_STYLES) as Array<keyof typeof CATEGORY_STYLES>).map((cat) => {
                    const style = CATEGORY_STYLES[cat];
                    const isSelected = category === cat;
                    const Icon = style.icon;
                    return (
                      <button
                        key={cat}
                        type="button"
                        data-compact
                        onClick={() => setCategory(cat)}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-lg border p-2 transition-all cursor-pointer",
                          isSelected
                            ? `${style.bg} border-violet-500 font-bold ring-1 ring-violet-500/20`
                            : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100",
                        )}
                      >
                        <Icon className={cn("mb-0.5 h-4 w-4", isSelected ? style.text : "text-slate-400")} />
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
              className="h-10 w-full rounded-xl bg-violet-700 text-sm font-bold text-white shadow-sm hover:bg-violet-800"
            >
              {isPending
                ? "Menyimpan..."
                : isEditMode
                  ? "Simpan Perubahan"
                  : "Simpan Misi Baru"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
