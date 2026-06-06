"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Gift, PiggyBank, Sparkles } from "lucide-react";
import type { Goal } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  requestGoalRewardRedeemAction,
  saveGoalHpToSavingsAction,
} from "@/app/child/targets/actions";
import { useQueryClient } from "@tanstack/react-query";
import { childQueryKeys } from "@/lib/child/query-keys";

type ChildGoalClaimPanelProps = {
  goal: Goal;
  goalSaveEnabled: boolean;
};

export function ChildGoalClaimPanel({ goal, goalSaveEnabled }: ChildGoalClaimPanelProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: childQueryKeys.targets(goal.profile_id) });
    void queryClient.invalidateQueries({ queryKey: childQueryKeys.savings(goal.profile_id) });
  };

  const handleRedeem = () => {
    startTransition(async () => {
      const res = await requestGoalRewardRedeemAction(goal.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Permintaan hadiah dikirim ke Papa/Mama!");
        setOpen(false);
        invalidate();
      }
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveGoalHpToSavingsAction(goal.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Energi berhasil ditabung ke kantong!");
        setOpen(false);
        invalidate();
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        className="w-full gap-1 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-700"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="size-4" aria-hidden />
        Pilih: Cair atau Tabung
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center font-heading">
              Target tercapai! 🎉
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              Kamu sudah mengumpulkan {goal.current_hp} energi untuk «{goal.title}».
              Mau dicairkan jadi hadiah, atau ditabung dulu?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleRedeem}
              className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-left transition-colors hover:bg-emerald-100 disabled:opacity-50"
            >
              <Gift className="size-8 shrink-0 text-emerald-700" aria-hidden />
              <div>
                <p className="text-sm font-bold text-emerald-900">Cairkan hadiah</p>
                <p className="text-[10px] text-emerald-700/80">
                  Papa/Mama akan menyetujui hadiah fisikmu.
                </p>
              </div>
            </button>

            {goalSaveEnabled ? (
              <button
                type="button"
                disabled={isPending}
                onClick={handleSave}
                className="flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/80 p-4 text-left transition-colors hover:bg-violet-100 disabled:opacity-50"
              >
                <PiggyBank className="size-8 shrink-0 text-violet-700" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-violet-900">Tabung energi</p>
                  <p className="text-[10px] text-violet-700/80">
                    Energi masuk kantong tabungan (bisa dapat bunga!).
                  </p>
                </div>
              </button>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full">
              Nanti dulu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
