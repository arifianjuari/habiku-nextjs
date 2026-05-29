"use client";

import { useState, useTransition } from "react";
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
  Calendar,
  Sparkles,
  Zap,
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
import { createGoal, toggleGoalStatus, deleteGoal } from "@/app/parent/targets/actions";
import type { ChildProfile, Goal } from "@/types/database";

interface TargetsClientViewProps {
  children: ChildProfile[];
  initialGoals: Goal[];
}

export function TargetsClientView({ children, initialGoals }: TargetsClientViewProps) {
  const [activeChildId, setActiveChildId] = useState<string>(
    children[0]?.id || ""
  );
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Create Form States
  const [title, setTitle] = useState("");
  const [targetHp, setTargetHp] = useState("100");
  const [makeActive, setMakeActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const activeChild = children.find((c) => c.id === activeChildId);
  const childGoals = goals.filter((g) => g.profile_id === activeChildId);

  // Group goals
  const activeGoals = childGoals.filter((g) => g.status === "active");
  const completedGoals = childGoals.filter((g) => g.status === "completed");
  const archivedGoals = childGoals.filter((g) => g.status === "archived");

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const formData = new FormData();
    formData.set("childId", activeChildId);
    formData.set("title", title);
    formData.set("targetHp", targetHp);
    formData.set("makeActive", String(makeActive));

    startTransition(async () => {
      const res = await createGoal(null, formData);
      if (res?.error) {
        setFormError(res.error);
        toast.error(res.error);
      } else if (res?.success && res.goal) {
        setGoals((prev) => [res.goal as Goal, ...prev]);
        toast.success("Target hadiah baru berhasil dibuat! 🎁");
        
        // Reset states
        setTitle("");
        setTargetHp("100");
        setMakeActive(true);
        setIsOpen(false);
      }
    });
  };

  const handleToggleStatus = (goalId: string, currentStatus: "active" | "completed" | "archived") => {
    if (currentStatus === "completed") {
      toast.error("Target hadiah yang sudah diklaim/selesai tidak bisa diubah statusnya.");
      return;
    }

    const nextStatus = currentStatus === "active" ? "archived" : "active";

    // Optimistic UI update
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, status: nextStatus } : g))
    );

    startTransition(async () => {
      const res = await toggleGoalStatus(goalId, currentStatus);
      if (res?.error) {
        // Rollback
        setGoals((prev) =>
          prev.map((g) => (g.id === goalId ? { ...g, status: currentStatus } : g))
        );
        toast.error(res.error);
      } else {
        toast.success(
          nextStatus === "active"
            ? "Target hadiah berhasil diaktifkan!"
            : "Target hadiah diarsipkan sementara."
        );
      }
    });
  };

  const handleDelete = (goalId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus target hadiah ini secara permanen?")) {
      return;
    }

    const previousGoals = [...goals];
    // Optimistic UI update
    setGoals((prev) => prev.filter((g) => g.id !== goalId));

    startTransition(async () => {
      const res = await deleteGoal(goalId);
      if (res?.error) {
        // Rollback
        setGoals(previousGoals);
        toast.error(res.error);
      } else {
        toast.success("Target hadiah berhasil dihapus.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Tab Selector Anak */}
      {children.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {children.map((child) => {
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

      {/* 2. Header & Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Target Hadiah {activeChild?.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            Atur hadiah impian anak yang ditebus menggunakan poin energi.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); setFormError(null); }}>
          <DialogTrigger
            className="group/button inline-flex shrink-0 items-center justify-center rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold h-9 px-3.5 shadow-md shadow-violet-950/10 cursor-pointer select-none outline-none text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Tambah Target
          </DialogTrigger>
          <DialogContent className="max-w-sm rounded-3xl border border-violet-100 bg-white/95 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg font-bold text-center flex items-center justify-center gap-2 text-slate-900">
                <Gift className="h-5 w-5 text-violet-700 animate-bounce" />
                Target Hadiah Baru
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-slate-500">
                Tentukan target hadiah seru untuk memotivasi {activeChild?.name}.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateGoal} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-bold text-slate-800">Nama Hadiah</Label>
                <Input
                  id="title"
                  placeholder="Misal: Mainan Lego Baru, Tiket Renang"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-violet-100 focus-visible:ring-violet-700 h-10 rounded-xl bg-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="targetHp" className="text-xs font-bold text-slate-800">Target HP (Energi yang Dibutuhkan)</Label>
                <Input
                  id="targetHp"
                  type="number"
                  min="1"
                  value={targetHp}
                  onChange={(e) => setTargetHp(e.target.value)}
                  className="border-violet-100 focus-visible:ring-violet-700 h-10 rounded-xl bg-white"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Semakin besar hadiahnya, semakin tinggi energi yang harus dikumpulkan!
                </p>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-violet-100 bg-slate-50/50 p-3">
                <button
                  type="button"
                  onClick={() => setMakeActive(!makeActive)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    makeActive ? "bg-violet-700" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      makeActive ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <div className="space-y-0.5 text-left">
                  <span className="text-xs font-bold text-slate-900 block leading-none">
                    Aktifkan Sekarang
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Langsung jadikan goal aktif yang dikumpulkan anak.
                  </span>
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
                  {isPending ? "Menyimpan Target..." : "Simpan Target Hadiah"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 3. Section Target Aktif */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Target className="h-4 w-4 text-violet-700" />
          Target Aktif yang Dikumpulkan ({activeGoals.length})
        </h3>
        
        {activeGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-dashed border-slate-200 bg-white/40 backdrop-blur-sm">
            <p className="text-xs font-semibold text-slate-500">Tidak ada target aktif</p>
            <p className="text-[10px] text-muted-foreground max-w-[200px] mt-0.5">
              Aktifkan target dari daftar arsip di bawah atau buat baru!
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {activeGoals.map((goal) => {
              const progress = Math.min(100, (goal.current_hp / goal.target_hp) * 100);
              return (
                <Card key={goal.id} className="overflow-hidden border border-violet-100 bg-white shadow-sm hover:shadow-md transition-all rounded-2xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                          <Gift className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 leading-snug">{goal.title}</h4>
                          <span className="text-[10px] bg-violet-50 text-violet-700 font-semibold px-2 py-0.5 rounded-full border border-violet-100">
                            Aktif
                          </span>
                        </div>
                      </div>

                      {/* Points / Energy Detail */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center gap-1 rounded-xl bg-amber-50 border border-amber-200/50 px-2.5 py-1 shadow-sm">
                          <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-extrabold text-amber-950">
                            {goal.current_hp} / {goal.target_hp} HP
                          </span>
                        </div>

                        {/* Toggles */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleStatus(goal.id, goal.status)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer"
                            title="Arsipkan Target"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(goal.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-red-100 hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                            title="Hapus Target"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                        <span>{Math.round(progress)}% Tercapai</span>
                        <span>{goal.target_hp - goal.current_hp} Poin Lagi</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Section Target Selesai */}
      {completedGoals.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Target yang Sudah Dicapai ({completedGoals.length})
          </h3>
          
          <div className="grid gap-3">
            {completedGoals.map((goal) => (
              <Card key={goal.id} className="overflow-hidden border border-emerald-100 bg-emerald-50/20 rounded-2xl">
                <CardContent className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-emerald-950 leading-snug">{goal.title}</h4>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                        Selesai / Sudah Diklaim
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-emerald-800">
                      {goal.target_hp} HP 🎉
                    </span>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-red-100 hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                      title="Hapus Target"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 5. Section Target Diarsipkan (Daftar Impian) */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Archive className="h-4 w-4 text-slate-500" />
          Daftar Impian / Diarsipkan ({archivedGoals.length})
        </h3>
        
        {archivedGoals.length === 0 ? (
          <div className="text-center py-5 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs bg-slate-50/20">
            Tidak ada target yang diarsipkan.
          </div>
        ) : (
          <div className="grid gap-2">
            {archivedGoals.map((goal) => (
              <Card key={goal.id} className="border border-slate-200 bg-white/70 backdrop-blur-sm rounded-xl">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-slate-400" />
                    <div>
                      <span className="font-semibold text-slate-800 text-xs block leading-none mb-1">
                        {goal.title}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Target: {goal.target_hp} HP • Progres: {goal.current_hp} HP
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleStatus(goal.id, goal.status)}
                      className="group/button inline-flex shrink-0 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold h-7 px-2.5 text-[10px] cursor-pointer select-none outline-none"
                    >
                      Aktifkan
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-red-50 hover:bg-red-50 text-red-400 hover:text-red-500 transition-colors cursor-pointer"
                      title="Hapus Target"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
