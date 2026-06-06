"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Target,
  Plus,
  Trash2,
  Gift,
  Award,
  Archive,
  CheckCircle2,
  Zap,
  Pencil,
  ChevronDown,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChildTabSelector } from "@/components/parent/child-tab-selector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createGoal,
  updateGoal,
  toggleGoalStatus,
  deleteGoal,
  transferGoalHpAction,
} from "@/app/parent/targets/actions";
import type { ChildProfile, Goal } from "@/types/database";
import { GoalVisualStateBadge } from "@/components/shared/goal-visual-state-badge";
import { getGoalVisualStateMeta } from "@/lib/goals/visual-state";
import { IncidentalRewardDialog } from "@/components/parent/incidental-reward-dialog";
import { cn } from "@/lib/utils";

interface TargetsClientViewProps {
  children: ChildProfile[];
  initialGoals: Goal[];
  activeChildId: string;
  onActiveChildIdChange: (childId: string) => void;
}

function CollapsibleSection({
  title,
  icon: Icon,
  count,
  isOpen,
  onToggle,
  iconClassName,
  children,
}: {
  title: string;
  icon: LucideIcon;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  iconClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/50">
      <button
        type="button"
        data-compact
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50/80 cursor-pointer"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClassName)} aria-hidden />
          <span className="truncate">{title}</span>
          <span className="shrink-0 text-slate-400">({count})</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-slate-100 p-2.5 pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FormSwitch({
  checked,
  onToggle,
  accent = "violet",
}: {
  checked: boolean;
  onToggle: () => void;
  accent?: "violet" | "emerald";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-compact
      onClick={onToggle}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none",
        checked
          ? accent === "emerald"
            ? "justify-end bg-emerald-500"
            : "justify-end bg-violet-700"
          : "justify-start bg-slate-300",
      )}
    >
      <span
        aria-hidden
        className="block h-4 w-4 shrink-0 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

export function TargetsClientView({
  children,
  initialGoals,
  activeChildId,
  onActiveChildIdChange,
}: TargetsClientViewProps) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [isOpen, setIsOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [targetHp, setTargetHp] = useState("100");
  const [makeActive, setMakeActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFromId, setTransferFromId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);

  const isEditMode = editingGoalId !== null;
  const activeChild = children.find((c) => c.id === activeChildId);
  const childGoals = goals.filter((g) => g.profile_id === activeChildId);

  const activeGoals = childGoals.filter((g) => g.status === "active");
  const readyToClaimGoals = childGoals.filter((g) => g.status === "ready_to_claim");
  const completedGoals = childGoals.filter((g) => g.status === "completed");
  const archivedGoals = childGoals.filter((g) => g.status === "archived");

  const goalsWithHp = activeGoals.filter((g) => g.current_hp > 0);
  const goalsWithRoom = activeGoals.filter((g) => g.current_hp < g.target_hp);
  const canTransferHp =
    activeGoals.length >= 2 && goalsWithHp.length > 0 && goalsWithRoom.length > 0;

  const transferMax = useMemo(() => {
    const from = activeGoals.find((g) => g.id === transferFromId);
    const to = activeGoals.find((g) => g.id === transferToId);
    if (!from || !to || from.id === to.id) return 0;
    return Math.min(from.current_hp, to.target_hp - to.current_hp);
  }, [activeGoals, transferFromId, transferToId]);

  const goalsByProfile = useMemo(() => {
    return children.reduce<Record<string, Goal[]>>((acc, child) => {
      acc[child.id] = goals.filter((g) => g.profile_id === child.id);
      return acc;
    }, {});
  }, [children, goals]);

  const resetForm = () => {
    setEditingGoalId(null);
    setTitle("");
    setTargetHp("100");
    setMakeActive(true);
    setFormError(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEditDialog = (goal: Goal) => {
    if (goal.status === "completed") {
      toast.error("Target yang sudah selesai tidak dapat diedit.");
      return;
    }
    setEditingGoalId(goal.id);
    setTitle(goal.title);
    setTargetHp(String(goal.target_hp));
    setMakeActive(goal.status === "active");
    setFormError(null);
    setIsOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  const handleSubmitGoal = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const formData = new FormData();
    formData.set("title", title);
    formData.set("targetHp", targetHp);

    startTransition(async () => {
      if (isEditMode && editingGoalId) {
        formData.set("goalId", editingGoalId);
        const res = await updateGoal(null, formData);
        if (res?.error) {
          setFormError(res.error);
          toast.error(res.error);
        } else if (res?.success && res.goal) {
          setGoals((prev) =>
            prev.map((g) => (g.id === editingGoalId ? (res.goal as Goal) : g)),
          );
          toast.success("Target hadiah berhasil diperbarui.");
          setIsOpen(false);
          resetForm();
        }
        return;
      }

      formData.set("childId", activeChildId);
      formData.set("makeActive", String(makeActive));
      const res = await createGoal(null, formData);
      if (res?.error) {
        setFormError(res.error);
        toast.error(res.error);
      } else if (res?.success && res.goal) {
        setGoals((prev) => [res.goal as Goal, ...prev]);
        toast.success("Target hadiah baru berhasil dibuat! 🎁");
        setIsOpen(false);
        resetForm();
      }
    });
  };

  const handleToggleStatus = (
    goalId: string,
    currentStatus: "active" | "ready_to_claim" | "completed" | "archived",
  ) => {
    if (currentStatus === "completed" || currentStatus === "ready_to_claim") {
      toast.error(
        currentStatus === "ready_to_claim"
          ? "Target sedang menunggu pilihan anak (cair atau tabung)."
          : "Target hadiah yang sudah diklaim/selesai tidak bisa diubah statusnya.",
      );
      return;
    }

    const nextStatus = currentStatus === "active" ? "archived" : "active";

    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, status: nextStatus } : g)),
    );

    startTransition(async () => {
      const res = await toggleGoalStatus(goalId, currentStatus);
      if (res?.error) {
        setGoals((prev) =>
          prev.map((g) => (g.id === goalId ? { ...g, status: currentStatus } : g)),
        );
        toast.error(res.error);
      } else {
        toast.success(
          nextStatus === "active"
            ? "Target hadiah berhasil diaktifkan!"
            : "Target hadiah diarsipkan sementara.",
        );
      }
    });
  };

  const resetTransferForm = () => {
    setTransferFromId("");
    setTransferToId("");
    setTransferAmount("");
    setTransferNote("");
    setTransferError(null);
  };

  const openTransferDialog = () => {
    const defaultFrom = goalsWithHp[0]?.id ?? "";
    const defaultTo =
      goalsWithRoom.find((g) => g.id !== defaultFrom)?.id ?? goalsWithRoom[0]?.id ?? "";
    setTransferFromId(defaultFrom);
    setTransferToId(defaultTo);
    setTransferAmount("");
    setTransferNote("");
    setTransferError(null);
    setTransferOpen(true);
  };

  const handleTransferOpenChange = (open: boolean) => {
    setTransferOpen(open);
    if (!open) resetTransferForm();
  };

  const handleTransferSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTransferError(null);

    const amount = Number.parseInt(transferAmount, 10);
    if (!transferFromId || !transferToId) {
      setTransferError("Pilih target asal dan tujuan.");
      return;
    }
    if (transferFromId === transferToId) {
      setTransferError("Target asal dan tujuan harus berbeda.");
      return;
    }
    if (!Number.isInteger(amount) || amount < 1) {
      setTransferError("Jumlah HP minimal 1.");
      return;
    }
    if (amount > transferMax) {
      setTransferError(`Maksimal ${transferMax} HP dapat dipindahkan.`);
      return;
    }

    const previousGoals = [...goals];
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id === transferFromId) {
          return { ...g, current_hp: g.current_hp - amount };
        }
        if (g.id === transferToId) {
          const newHp = g.current_hp + amount;
          return {
            ...g,
            current_hp: newHp,
            status: newHp >= g.target_hp ? ("completed" as const) : g.status,
          };
        }
        return g;
      }),
    );

    startTransition(async () => {
      const res = await transferGoalHpAction(
        activeChildId,
        transferFromId,
        transferToId,
        amount,
        transferNote,
      );
      if (res?.error) {
        setGoals(previousGoals);
        setTransferError(res.error);
        toast.error(res.error);
      } else {
        toast.success(`Berhasil memindahkan ${amount} HP antar target! ⚡`);
        setTransferOpen(false);
        resetTransferForm();
      }
    });
  };

  const handleDelete = (goal: Goal) => {
    if (goal.current_hp > 0 && goal.status !== "completed") {
      toast.error(
        `Target masih berisi ${goal.current_hp} HP. Transfer ke target lain terlebih dahulu sebelum menghapus.`,
      );
      return;
    }

    if (!confirm("Apakah Anda yakin ingin menghapus target hadiah ini secara permanen?")) {
      return;
    }

    const previousGoals = [...goals];
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));

    startTransition(async () => {
      const res = await deleteGoal(goal.id);
      if (res?.error) {
        setGoals(previousGoals);
        toast.error(res.error);
      } else {
        toast.success("Target hadiah berhasil dihapus.");
      }
    });
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <div className="space-y-3 pb-12">
        <ChildTabSelector
          profiles={children}
          activeChildId={activeChildId}
          onActiveChildIdChange={onActiveChildIdChange}
        />

        {/* Target Aktif */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Target className="h-3.5 w-3.5 shrink-0 text-violet-700" aria-hidden />
              <span className="truncate">Target Aktif ({activeGoals.length})</span>
            </h3>
            {canTransferHp ? (
              <button
                type="button"
                data-compact
                onClick={openTransferDialog}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-800 transition-colors hover:bg-violet-100 cursor-pointer"
              >
                <ArrowLeftRight className="h-3 w-3" aria-hidden />
                Transfer
              </button>
            ) : null}
          </div>

          {activeGoals.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/40 p-6 text-center backdrop-blur-sm">
              <p className="text-xs font-semibold text-slate-500">Tidak ada target aktif</p>
              <p className="mt-0.5 max-w-[200px] text-[10px] text-muted-foreground">
                Aktifkan target dari arsip atau buat baru!
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {activeGoals.map((goal) => {
                const progress = Math.min(100, (goal.current_hp / goal.target_hp) * 100);
                const visualMeta = getGoalVisualStateMeta(goal.visual_state);

                return (
                  <motion.div
                    key={goal.id}
                    layout
                    className={cn(
                      "overflow-hidden rounded-xl border bg-white shadow-sm transition-all",
                      visualMeta.cardClass || "border-violet-100",
                    )}
                  >
                    <div className="flex items-start gap-2 p-2.5">
                      <button
                        type="button"
                        onClick={() => openEditDialog(goal)}
                        className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg text-left transition-colors hover:bg-slate-50/80 active:bg-slate-100/80 cursor-pointer"
                        aria-label={`Edit target ${goal.title}`}
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                          <Gift className="h-4 w-4" aria-hidden />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="space-y-1">
                            <h4 className="text-xs font-semibold leading-snug break-words text-slate-900 [overflow-wrap:anywhere]">
                              {goal.title}
                            </h4>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full border border-violet-100 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                                Aktif
                              </span>
                              <GoalVisualStateBadge state={goal.visual_state} />
                              <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-200/50 bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-amber-950">
                                <Zap className="h-2.5 w-2.5 fill-amber-400 text-amber-500" aria-hidden />
                                {goal.current_hp}/{goal.target_hp}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-0.5">
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                              <span>{Math.round(progress)}% tercapai</span>
                              <span>{Math.max(0, goal.target_hp - goal.current_hp)} HP lagi</span>
                            </div>
                          </div>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-1 self-center">
                        <button
                          type="button"
                          data-compact
                          onClick={() => handleToggleStatus(goal.id, goal.status)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 cursor-pointer"
                          title="Arsipkan Target"
                          aria-label="Arsipkan target"
                        >
                          <Archive className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          data-compact
                          onClick={() => handleDelete(goal)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-100 text-red-500 transition-colors hover:bg-red-50 cursor-pointer"
                          title="Hapus Target"
                          aria-label="Hapus target"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {readyToClaimGoals.length > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              <Gift className="h-3.5 w-3.5" aria-hidden />
              Siap Dipilih Anak ({readyToClaimGoals.length})
            </h3>
            <div className="grid gap-2">
              {readyToClaimGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/40 p-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Zap className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold leading-snug break-words text-amber-950 [overflow-wrap:anywhere]">
                      {goal.title}
                    </h4>
                    <p className="mt-0.5 text-[10px] text-amber-800">
                      {goal.current_hp}/{goal.target_hp} HP — anak memilih cair hadiah atau tabung.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Target Selesai — collapse default */}
        {completedGoals.length > 0 && (
          <CollapsibleSection
            title="Sudah Dicapai"
            icon={CheckCircle2}
            iconClassName="text-emerald-600"
            count={completedGoals.length}
            isOpen={completedOpen}
            onToggle={() => setCompletedOpen((prev) => !prev)}
          >
            <div className="grid gap-2">
              {completedGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/20 p-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Award className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold leading-snug break-words text-emerald-950 [overflow-wrap:anywhere]">
                      {goal.title}
                    </h4>
                    <span className="mt-0.5 inline-block rounded-full border border-emerald-200 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                      Selesai · {goal.target_hp} HP
                    </span>
                  </div>
                  <button
                    type="button"
                    data-compact
                    onClick={() => handleDelete(goal)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-100 text-red-500 transition-colors hover:bg-red-50 cursor-pointer"
                    title="Hapus Target"
                    aria-label="Hapus target"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Target Diarsipkan — collapse default */}
        <CollapsibleSection
          title="Diarsipkan"
          icon={Archive}
          iconClassName="text-slate-500"
          count={archivedGoals.length}
          isOpen={archivedOpen}
          onToggle={() => setArchivedOpen((prev) => !prev)}
        >
          {archivedGoals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/20 py-3 text-center text-xs text-slate-400">
              Tidak ada target yang diarsipkan.
            </div>
          ) : (
            <div className="grid gap-2">
              {archivedGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 p-2.5"
                >
                  <button
                    type="button"
                    onClick={() => openEditDialog(goal)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left transition-colors hover:bg-slate-50/80 active:bg-slate-100/80 cursor-pointer"
                    aria-label={`Edit target ${goal.title}`}
                  >
                    <Gift className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold leading-snug break-words text-slate-800 [overflow-wrap:anywhere]">
                        {goal.title}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {goal.current_hp}/{goal.target_hp} HP
                      </span>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      data-compact
                      onClick={() => handleToggleStatus(goal.id, goal.status)}
                      className="inline-flex h-7 items-center justify-center rounded-lg bg-slate-100 px-2 text-[10px] font-bold text-slate-700 transition-colors hover:bg-slate-200 cursor-pointer"
                    >
                      Aktifkan
                    </button>
                    <button
                      type="button"
                      data-compact
                      onClick={() => handleDelete(goal)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-50 text-red-400 transition-colors hover:bg-red-50 hover:text-red-500 cursor-pointer"
                      title="Hapus Target"
                      aria-label="Hapus target"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      </div>

      {/* FAB — mengambang di atas bottom nav */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.625rem)] z-50">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center justify-center gap-2 px-4">
          <button
            type="button"
            data-compact
            onClick={() => setRewardOpen(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-orange-500 px-4 text-xs font-bold text-white shadow-lg shadow-orange-950/25 ring-1 ring-orange-600/30 transition-colors hover:bg-orange-600 cursor-pointer select-none outline-none"
          >
            <Gift className="h-4 w-4" aria-hidden />
            Reward
          </button>
          <button
            type="button"
            data-compact
            onClick={openCreateDialog}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-violet-700 px-4 text-xs font-bold text-white shadow-lg shadow-violet-950/25 ring-1 ring-violet-600/20 transition-colors hover:bg-violet-800 cursor-pointer select-none outline-none"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Tambah Target
          </button>
        </div>
      </div>

      <DialogContent className="max-w-sm rounded-3xl border border-violet-100 bg-white/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center justify-center gap-2 text-center text-lg font-bold text-slate-900">
            {isEditMode ? (
              <>
                <Pencil className="h-5 w-5 text-violet-700" />
                Edit Target Hadiah
              </>
            ) : (
              <>
                <Gift className="h-5 w-5 text-violet-700" />
                Target Baru untuk {activeChild?.name}
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-slate-500">
            {isEditMode
              ? "Ubah nama hadiah atau target energi yang dibutuhkan."
              : `Tentukan hadiah seru untuk memotivasi ${activeChild?.name}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmitGoal} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-bold text-slate-800">
              Nama Hadiah
            </Label>
            <Input
              id="title"
              placeholder="Misal: Mainan Lego Baru, Tiket Renang"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 rounded-xl border-violet-100 bg-white text-sm focus-visible:ring-violet-700"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="targetHp" className="text-xs font-bold text-slate-800">
              Target HP (Energi)
            </Label>
            <Input
              id="targetHp"
              type="number"
              min="1"
              value={targetHp}
              onChange={(e) => setTargetHp(e.target.value)}
              className="h-9 rounded-xl border-violet-100 bg-white text-sm focus-visible:ring-violet-700"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Semakin besar hadiahnya, semakin tinggi energi yang harus dikumpulkan.
            </p>
          </div>

          {!isEditMode && (
            <div className="flex items-center gap-2.5 rounded-xl border border-violet-100 bg-slate-50/50 p-2.5">
              <FormSwitch checked={makeActive} onToggle={() => setMakeActive(!makeActive)} />
              <div className="space-y-0.5 text-left">
                <span className="block text-xs font-bold leading-none text-slate-900">
                  Aktifkan Sekarang
                </span>
                <span className="text-[10px] text-slate-500">
                  Langsung jadikan target aktif yang dikumpulkan anak.
                </span>
              </div>
            </div>
          )}

          {formError && (
            <p
              className="rounded-lg border border-red-100 bg-red-50 p-2.5 text-center text-xs font-semibold text-red-600"
              role="alert"
            >
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
                  : "Simpan Target Hadiah"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={transferOpen} onOpenChange={handleTransferOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border border-violet-100 bg-white/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center justify-center gap-2 text-center text-lg font-bold text-slate-900">
            <ArrowLeftRight className="h-5 w-5 text-violet-700" aria-hidden />
            Transfer Energi
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-slate-500">
            Pindahkan HP dari satu target aktif ke target lain milik {activeChild?.name}.
            Energi tidak masuk ke ledger — hanya dialihkan antar target.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleTransferSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="transfer-from" className="text-xs font-bold text-slate-800">
              Dari target
            </Label>
            <select
              id="transfer-from"
              value={transferFromId}
              onChange={(e) => {
                setTransferFromId(e.target.value);
                setTransferAmount("");
              }}
              required
              className="h-9 w-full rounded-xl border border-violet-100 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-700"
            >
              <option value="">— Pilih target asal —</option>
              {goalsWithHp.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} ({g.current_hp} HP tersedia)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-to" className="text-xs font-bold text-slate-800">
              Ke target
            </Label>
            <select
              id="transfer-to"
              value={transferToId}
              onChange={(e) => {
                setTransferToId(e.target.value);
                setTransferAmount("");
              }}
              required
              className="h-9 w-full rounded-xl border border-violet-100 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-700"
            >
              <option value="">— Pilih target tujuan —</option>
              {goalsWithRoom
                .filter((g) => g.id !== transferFromId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} ({g.current_hp}/{g.target_hp} HP · sisa{" "}
                    {g.target_hp - g.current_hp})
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-amount" className="text-xs font-bold text-slate-800">
              Jumlah HP
            </Label>
            <Input
              id="transfer-amount"
              type="number"
              min={1}
              max={transferMax > 0 ? transferMax : undefined}
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder={transferMax > 0 ? `Maks. ${transferMax} HP` : "Pilih target dulu"}
              disabled={transferMax <= 0}
              className="h-9 rounded-xl border-violet-100 bg-white text-sm focus-visible:ring-violet-700"
              required
            />
            {transferMax > 0 ? (
              <button
                type="button"
                data-compact
                onClick={() => setTransferAmount(String(transferMax))}
                className="text-[10px] font-semibold text-violet-700 hover:text-violet-900 cursor-pointer"
              >
                Isi maksimal ({transferMax} HP)
              </button>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-note" className="text-xs font-bold text-slate-800">
              Catatan (opsional)
            </Label>
            <Input
              id="transfer-note"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              maxLength={200}
              placeholder="Misal: Alihkan ke target mainan"
              className="h-9 rounded-xl border-violet-100 bg-white text-sm focus-visible:ring-violet-700"
            />
          </div>

          {transferError ? (
            <p
              className="rounded-lg border border-red-100 bg-red-50 p-2.5 text-center text-xs font-semibold text-red-600"
              role="alert"
            >
              {transferError}
            </p>
          ) : null}

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={isPending || transferMax <= 0}
              className="h-10 w-full rounded-xl bg-violet-700 text-sm font-bold text-white shadow-sm hover:bg-violet-800"
            >
              {isPending ? "Memindahkan..." : "Transfer HP"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <IncidentalRewardDialog
      open={rewardOpen}
      onOpenChange={setRewardOpen}
      children={children}
      goalsByProfile={goalsByProfile}
      activeChildId={activeChildId}
      onActiveChildIdChange={onActiveChildIdChange}
      onSuccess={({ goal }) => {
        if (goal) {
          setGoals((prev) => prev.map((g) => (g.id === goal.id ? goal : g)));
        }
      }}
    />
    </>
  );
}
