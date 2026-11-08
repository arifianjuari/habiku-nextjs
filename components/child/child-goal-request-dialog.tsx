"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Gift, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { submitGoalRequestAction } from "@/app/child/actions";
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
import { childQueryKeys } from "@/lib/child/query-keys";
import {
  GOAL_REQUEST_HP_MAX,
  GOAL_REQUEST_NOTE_MAX,
  GOAL_REQUEST_TITLE_MAX,
  parseGoalRequestHp,
} from "@/lib/goals/goal-request";

type ChildGoalRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
};

export function ChildGoalRequestDialog({
  open,
  onOpenChange,
  profileId,
}: ChildGoalRequestDialogProps) {
  const [title, setTitle] = useState("");
  const [targetHp, setTargetHp] = useState("100");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  const resetForm = () => {
    setTitle("");
    setTargetHp("100");
    setNote("");
    setFormError(null);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      resetForm();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError("Nama hadiah wajib diisi.");
      return;
    }

    const hp = parseGoalRequestHp(targetHp);
    if (hp === null) {
      setFormError("Energi target harus antara 1 dan 100.000.");
      return;
    }

    startTransition(async () => {
      const res = await submitGoalRequestAction(profileId, title, hp, note || undefined);

      if (res.error) {
        setFormError(res.error);
        toast.error(res.error);
        return;
      }

      toast.success("Pengajuan target terkirim ke Papa/Mama!");
      await queryClient.invalidateQueries({
        queryKey: childQueryKeys.targets(profileId),
      });
      handleOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border border-violet-100 bg-white/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center justify-center gap-2 text-center text-lg font-bold text-slate-900">
            <Gift className="h-5 w-5 text-violet-600" aria-hidden />
            Ajukan Target
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-slate-500">
            Tulis hadiah yang kamu inginkan dan berapa energi yang perlu
            dikumpulkan. Papa atau Mama akan meninjau dulu ya!
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="goal-request-title" className="text-xs font-bold text-slate-800">
              Nama hadiah
            </Label>
            <Input
              id="goal-request-title"
              placeholder="Misal: Sepatu baru"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 rounded-xl border-violet-100 text-sm"
              maxLength={GOAL_REQUEST_TITLE_MAX}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="goal-request-hp"
              className="flex items-center gap-1 text-xs font-bold text-slate-800"
            >
              <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden />
              Energi target
            </Label>
            <Input
              id="goal-request-hp"
              type="number"
              min={1}
              max={GOAL_REQUEST_HP_MAX}
              value={targetHp}
              onChange={(e) => setTargetHp(e.target.value)}
              className="h-9 rounded-xl border-violet-100 text-sm"
              required
            />
            <p className="text-[10px] text-slate-400">
              Jumlah energi yang harus terkumpul supaya hadiah ini bisa dicairkan.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-request-note" className="text-xs font-bold text-slate-800">
              Catatan (opsional)
            </Label>
            <Input
              id="goal-request-note"
              placeholder="Kenapa kamu ingin hadiah ini?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-9 rounded-xl border-violet-100 text-sm"
              maxLength={GOAL_REQUEST_NOTE_MAX}
            />
          </div>

          {formError ? (
            <p
              className="rounded-lg border border-red-100 bg-red-50 p-2.5 text-center text-xs font-semibold text-red-600"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          <DialogFooter className="pt-1">
            <Button
              type="submit"
              disabled={isPending}
              className="h-10 w-full rounded-xl bg-violet-700 text-sm font-bold text-white hover:bg-violet-800"
            >
              {isPending ? "Mengirim..." : "Kirim ke Ortu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
