"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Lightbulb, Zap } from "lucide-react";
import { submitTaskRequestAction } from "@/app/child/actions";
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
import { useQueryClient } from "@tanstack/react-query";
import { childQueryKeys } from "@/lib/child/query-keys";

type ChildMissionRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
};

export function ChildMissionRequestDialog({
  open,
  onOpenChange,
  profileId,
}: ChildMissionRequestDialogProps) {
  const [title, setTitle] = useState("");
  const [rewardPoints, setRewardPoints] = useState("10");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  const resetForm = () => {
    setTitle("");
    setRewardPoints("10");
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

    const reward = Number(rewardPoints);
    if (!title.trim()) {
      setFormError("Nama misi wajib diisi.");
      return;
    }
    if (!Number.isFinite(reward) || reward < 1) {
      setFormError("Energi harus minimal 1.");
      return;
    }

    startTransition(async () => {
      const res = await submitTaskRequestAction(
        profileId,
        title,
        reward,
        note || undefined,
      );

      if (res.error) {
        setFormError(res.error);
        toast.error(res.error);
        return;
      }

      toast.success("Pengajuan misi terkirim ke Papa/Mama! 🎯");
      await queryClient.invalidateQueries({
        queryKey: childQueryKeys.missions(profileId),
      });
      handleOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border border-emerald-100 bg-white/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center justify-center gap-2 text-center text-lg font-bold text-slate-900">
            <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden />
            Ajukan Misi Baru
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-slate-500">
            Ceritakan misi yang ingin kamu kerjakan dan berapa energi yang kamu
            inginkan. Papa atau Mama akan meninjau dulu ya!
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="mission-title" className="text-xs font-bold text-slate-800">
              Nama Misi
            </Label>
            <Input
              id="mission-title"
              placeholder="Misal: Menyiram tanaman"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 rounded-xl border-emerald-100 text-sm"
              maxLength={120}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="mission-reward"
              className="flex items-center gap-1 text-xs font-bold text-slate-800"
            >
              <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden />
              Energi yang Diminta
            </Label>
            <Input
              id="mission-reward"
              type="number"
              min={1}
              max={50}
              value={rewardPoints}
              onChange={(e) => setRewardPoints(e.target.value)}
              className="h-9 rounded-xl border-emerald-100 text-sm"
              required
            />
            <p className="text-[10px] text-slate-400">
              Papa/Mama bisa menyesuaikan saat menyetujui.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mission-note" className="text-xs font-bold text-slate-800">
              Catatan (opsional)
            </Label>
            <Input
              id="mission-note"
              placeholder="Kenapa misi ini penting?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-9 rounded-xl border-emerald-100 text-sm"
              maxLength={200}
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
              className="h-10 w-full rounded-xl bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-800"
            >
              {isPending ? "Mengirim..." : "Kirim ke Ortu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
