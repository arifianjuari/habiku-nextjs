"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gift, Pencil, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  dismissSharedFamilyGoalCelebrationAction,
  saveSharedFamilyGoalAction,
} from "@/app/parent/actions/shared-family-goal";
import {
  EMPTY_FAMILY_SHARED_GOAL,
  getSharedFamilyGoalPercent,
  isSharedFamilyGoalActive,
  SHARED_FAMILY_GOAL_MAX_TARGET,
  SHARED_FAMILY_GOAL_MIN_TARGET,
  shouldCelebrateSharedFamilyGoal,
  type FamilySharedGoal,
} from "@/lib/parent/family-shared-goal";
import { cn } from "@/lib/utils";

type FamilySharedGoalHeroProps = {
  sharedFamilyGoal: FamilySharedGoal;
};

export function FamilySharedGoalHero({
  sharedFamilyGoal = EMPTY_FAMILY_SHARED_GOAL,
}: FamilySharedGoalHeroProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(sharedFamilyGoal.title ?? "");
  const [target, setTarget] = useState(
    sharedFamilyGoal.targetPoints != null ? String(sharedFamilyGoal.targetPoints) : "",
  );
  const [celebrationOpen, setCelebrationOpen] = useState(false);

  const isActive = isSharedFamilyGoalActive(sharedFamilyGoal);
  const percent =
    isActive && sharedFamilyGoal.targetPoints != null
      ? getSharedFamilyGoalPercent(
          sharedFamilyGoal.familyEarnEnergy,
          sharedFamilyGoal.targetPoints,
        )
      : 0;
  const isComplete =
    isActive &&
    sharedFamilyGoal.targetPoints != null &&
    sharedFamilyGoal.familyEarnEnergy >= sharedFamilyGoal.targetPoints;

  useEffect(() => {
    setTitle(sharedFamilyGoal.title ?? "");
    setTarget(
      sharedFamilyGoal.targetPoints != null ? String(sharedFamilyGoal.targetPoints) : "",
    );
    if (!isSharedFamilyGoalActive(sharedFamilyGoal)) {
      setIsEditing(true);
    }
  }, [sharedFamilyGoal]);

  useEffect(() => {
    if (shouldCelebrateSharedFamilyGoal(sharedFamilyGoal)) {
      setCelebrationOpen(true);
    }
  }, [sharedFamilyGoal]);

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const parsedTarget = trimmedTitle ? Number.parseInt(target, 10) : null;

    startTransition(async () => {
      const res = await saveSharedFamilyGoalAction(trimmedTitle, parsedTarget);
      if (res?.error) {
        toast.error(res.error);
        return;
      }

      if (trimmedTitle) {
        toast.success("Reward keluarga disimpan.");
        setIsEditing(false);
      } else {
        toast.success("Reward keluarga dinonaktifkan.");
        setIsEditing(true);
      }
    });
  };

  const handleDismissCelebration = () => {
    setCelebrationOpen(false);
    startTransition(async () => {
      const res = await dismissSharedFamilyGoalCelebrationAction();
      if (res?.error) {
        toast.error(res.error);
        router.refresh();
      }
    });
  };

  return (
    <>
      <div className="mt-2 rounded-xl bg-linear-to-r from-violet-500/10 via-indigo-500/5 to-transparent px-2.5 py-2 ring-1 ring-violet-500/10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15">
              <Zap className="size-4 fill-amber-500 text-amber-500" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Energi terkumpul bersama
              </p>
              <div className="flex items-baseline gap-1">
                <span className="font-heading text-2xl font-black leading-none tabular-nums text-foreground">
                  {sharedFamilyGoal.familyEarnEnergy}
                </span>
                <span className="text-xs font-bold text-muted-foreground">E</span>
                {isActive && sharedFamilyGoal.targetPoints != null ? (
                  <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                    / {sharedFamilyGoal.targetPoints}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {isActive && !isEditing ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              data-compact
              aria-label="Ubah reward keluarga"
              onClick={() => setIsEditing(true)}
              className="shrink-0 text-muted-foreground"
            >
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
        </div>

        {isActive && !isEditing ? (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1 truncate text-xs font-bold text-foreground">
                <Gift className="size-3 shrink-0 text-violet-600" aria-hidden />
                <span className="truncate">{sharedFamilyGoal.title}</span>
              </p>
              <span
                className={cn(
                  "shrink-0 text-[11px] font-black tabular-nums",
                  isComplete ? "text-emerald-600" : "text-violet-700",
                )}
              >
                {percent}%
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progres reward keluarga ${sharedFamilyGoal.title}`}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isComplete
                    ? "bg-linear-to-r from-emerald-500 to-teal-500"
                    : "bg-linear-to-r from-violet-500 to-indigo-500",
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-pretty">
              Anak-anak mengumpulkan energi bersama menuju hadiah ini.
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-2 border-t border-violet-500/10 pt-2">
            <p className="text-[10px] font-semibold text-muted-foreground text-pretty">
              Tentukan hadiah keluarga agar anak semangat bekerja sama.
            </p>
            <div className="space-y-1">
              <Label htmlFor="shared-goal-title" className="text-[10px] font-bold">
                Judul reward
              </Label>
              <Input
                id="shared-goal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Misal: Makan di restoran favorit"
                maxLength={80}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shared-goal-target" className="text-[10px] font-bold">
                Target energi (E)
              </Label>
              <Input
                id="shared-goal-target"
                type="number"
                min={SHARED_FAMILY_GOAL_MIN_TARGET}
                max={SHARED_FAMILY_GOAL_MAX_TARGET}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={`${SHARED_FAMILY_GOAL_MIN_TARGET}–${SHARED_FAMILY_GOAL_MAX_TARGET}`}
                className="h-9 text-sm tabular-nums"
              />
            </div>
            <div className="flex gap-1.5">
              {isActive ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    setTitle(sharedFamilyGoal.title ?? "");
                    setTarget(
                      sharedFamilyGoal.targetPoints != null
                        ? String(sharedFamilyGoal.targetPoints)
                        : "",
                    );
                    setIsEditing(false);
                  }}
                  className="h-9 flex-1 rounded-lg text-xs"
                >
                  Batal
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={handleSave}
                className="h-9 flex-1 rounded-lg bg-violet-600 text-xs font-bold text-white hover:bg-violet-700"
              >
                Simpan reward
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={celebrationOpen}
        onOpenChange={(open) => {
          if (!open) handleDismissCelebration();
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-3xl sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <div className="mb-1 flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-amber-100 to-violet-100">
              <Sparkles className="size-7 text-violet-600" aria-hidden />
            </div>
            <DialogTitle className="font-heading text-base font-bold">
              Target reward tercapai!
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground text-pretty">
              Keluarga telah mengumpulkan{" "}
              <span className="font-bold text-foreground">
                {sharedFamilyGoal.familyEarnEnergy} E
              </span>{" "}
              untuk{" "}
              <span className="font-bold text-foreground">{sharedFamilyGoal.title}</span>. Saatnya
              rayakan bersama anak-anak!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={handleDismissCelebration}
              disabled={isPending}
              className="h-11 w-full rounded-xl bg-violet-600 font-bold text-white hover:bg-violet-700"
            >
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
