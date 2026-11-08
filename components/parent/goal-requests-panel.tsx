"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Clock, Gift, X, Zap } from "lucide-react";
import {
  approveGoalRequestAction,
  rejectGoalRequestAction,
} from "@/app/parent/targets/actions";
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
  GOAL_REQUEST_HP_MAX,
  parseGoalRequestHp,
} from "@/lib/goals/goal-request";
import type { PendingGoalRequest } from "@/lib/parent/fetch-family-page-data";
import type { Goal } from "@/types/database";

type GoalRequestsPanelProps = {
  requests: PendingGoalRequest[];
  onRequestsChange: (requests: PendingGoalRequest[]) => void;
  onGoalCreated?: (goal: Goal) => void;
};

export function GoalRequestsPanel({
  requests,
  onRequestsChange,
  onGoalCreated,
}: GoalRequestsPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [approveId, setApproveId] = useState<string | null>(null);
  const [targetHp, setTargetHp] = useState("100");

  const selectedRequest = requests.find((request) => request.id === approveId) ?? null;

  const openApproveDialog = (request: PendingGoalRequest) => {
    setApproveId(request.id);
    setTargetHp(String(request.requested_target_hp ?? 100));
  };

  const closeApproveDialog = () => {
    setApproveId(null);
  };

  const handleReject = (requestId: string) => {
    if (!confirm("Tolak pengajuan target ini?")) {
      return;
    }

    const previous = requests;
    onRequestsChange(requests.filter((request) => request.id !== requestId));

    startTransition(async () => {
      const res = await rejectGoalRequestAction(requestId);
      if (res.error) {
        onRequestsChange(previous);
        toast.error(res.error);
      } else {
        toast.success("Pengajuan target ditolak.");
      }
    });
  };

  const handleApprove = () => {
    if (!approveId) return;

    const hp = parseGoalRequestHp(targetHp);
    if (hp === null) {
      toast.error("Energi target harus antara 1 dan 100.000.");
      return;
    }

    const previous = requests;
    onRequestsChange(requests.filter((request) => request.id !== approveId));

    startTransition(async () => {
      const res = await approveGoalRequestAction(approveId, hp);
      if (res.error) {
        onRequestsChange(previous);
        toast.error(res.error);
        return;
      }

      toast.success("Target baru dibuat dari pengajuan anak!");
      if (res.goal) {
        onGoalCreated?.(res.goal);
      }
      closeApproveDialog();
    });
  };

  if (requests.length === 0) {
    return null;
  }

  return (
    <>
      <section className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wide text-violet-800">
          <Gift className="h-3.5 w-3.5 text-violet-600" aria-hidden />
          Pengajuan target dari anak ({requests.length})
        </p>
        <div className="flex flex-col gap-1.5 rounded-xl border border-violet-200 bg-violet-50/90 p-2">
          {requests.map((request) => {
            const proposed =
              request.requested_target_hp != null
                ? `Usulan ${request.requested_target_hp} energi`
                : "Belum ada usulan energi";
            const meta = request.note
              ? `${request.child_name} · ${proposed} · ${request.note}`
              : `${request.child_name} · ${proposed}`;

            return (
              <div
                key={request.id}
                className="flex items-center gap-2 rounded-lg border border-violet-100 bg-white px-2 py-1.5"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-600 text-white">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                </div>

                <div className="min-w-0 flex-1 leading-none">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="truncate text-[13px] font-bold text-slate-900">
                      {request.title}
                    </p>
                    {request.requested_target_hp != null ? (
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-black text-violet-800">
                        <Zap
                          className="h-2.5 w-2.5 fill-amber-500 text-amber-500"
                          aria-hidden
                        />
                        {request.requested_target_hp} E
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[9px] font-medium text-slate-500">
                    {meta}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-1 self-center">
                  <Button
                    size="xs"
                    disabled={isPending}
                    onClick={() => openApproveDialog(request)}
                    className="h-6 min-h-0 rounded-md bg-violet-700 px-2 text-[9px] font-bold hover:bg-violet-800"
                    aria-label={`Setujui pengajuan ${request.title}`}
                  >
                    <Check className="h-3 w-3" aria-hidden />
                    Setujui
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => handleReject(request.id)}
                    className="h-6 min-h-0 rounded-md border-red-200 px-2 text-[9px] font-bold text-red-600 hover:bg-red-50"
                    aria-label={`Tolak pengajuan ${request.title}`}
                  >
                    <X className="h-3 w-3" aria-hidden />
                    Tolak
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Dialog open={approveId !== null} onOpenChange={(open) => !open && closeApproveDialog()}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-center text-lg font-bold">
              Setujui Pengajuan Target
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              {selectedRequest
                ? `${selectedRequest.child_name} ingin «${selectedRequest.title}». Usulan energinya sudah terisi — sesuaikan kalau perlu sebelum target dibuat.`
                : "Konfirmasi energi target sebelum hadiah ditambahkan."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 pt-1">
            <Label htmlFor="approve-goal-hp" className="text-xs font-bold">
              Energi target
            </Label>
            <Input
              id="approve-goal-hp"
              type="number"
              min={1}
              max={GOAL_REQUEST_HP_MAX}
              value={targetHp}
              onChange={(e) => setTargetHp(e.target.value)}
              className="h-9 rounded-xl"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              onClick={handleApprove}
              disabled={isPending}
              className="h-10 w-full rounded-xl bg-violet-700 font-bold hover:bg-violet-800"
            >
              {isPending ? "Menyimpan..." : "Buat Target & Setujui"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
