"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Clock, Lightbulb, X, Zap } from "lucide-react";
import type { PendingTaskRequest } from "@/lib/parent/fetch-family-page-data";
import type { TaskCategory } from "@/lib/database/enums";
import {
  approveTaskRequestAction,
  rejectTaskRequestAction,
} from "@/app/parent/tasks/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

const CATEGORY_OPTIONS: { value: TaskCategory; label: string }[] = [
  { value: "ibadah", label: "Ibadah" },
  { value: "belajar", label: "Belajar" },
  { value: "kebersihan", label: "Kebersihan" },
  { value: "olahraga", label: "Olahraga" },
  { value: "lainnya", label: "Lainnya" },
];

type TaskRequestsPanelProps = {
  requests: PendingTaskRequest[];
  onRequestsChange: (requests: PendingTaskRequest[]) => void;
  onTaskCreated?: (task: Task) => void;
};

export function TaskRequestsPanel({
  requests,
  onRequestsChange,
  onTaskCreated,
}: TaskRequestsPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rewardPoints, setRewardPoints] = useState("10");
  const [category, setCategory] = useState<TaskCategory>("lainnya");

  const selectedRequest = requests.find((r) => r.id === approveId) ?? null;

  const openApproveDialog = (request: PendingTaskRequest) => {
    setApproveId(request.id);
    setRewardPoints(String(request.requested_reward_points));
    setCategory("lainnya");
  };

  const closeApproveDialog = () => {
    setApproveId(null);
  };

  const handleReject = (requestId: string) => {
    if (!confirm("Tolak pengajuan misi ini?")) {
      return;
    }

    const previous = requests;
    onRequestsChange(requests.filter((r) => r.id !== requestId));

    startTransition(async () => {
      const res = await rejectTaskRequestAction(requestId);
      if (res.error) {
        onRequestsChange(previous);
        toast.error(res.error);
      } else {
        toast.success("Pengajuan misi ditolak.");
      }
    });
  };

  const handleApprove = () => {
    if (!approveId) return;

    const reward = Number(rewardPoints);
    if (!Number.isFinite(reward) || reward < 1) {
      toast.error("Energi harus minimal 1.");
      return;
    }

    const previous = requests;
    onRequestsChange(requests.filter((r) => r.id !== approveId));

    startTransition(async () => {
      const res = await approveTaskRequestAction(approveId, reward, category);
      if (res.error) {
        onRequestsChange(previous);
        toast.error(res.error);
      } else {
        toast.success("Misi baru ditambahkan dari pengajuan anak! 🌟");
        if (res.task) {
          onTaskCreated?.(res.task as Task);
        }
        closeApproveDialog();
      }
    });
  };

  if (requests.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/80">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-amber-600" aria-hidden />
            Pengajuan Misi dari Anak ({requests.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {request.child_name}
                </p>
                <p className="text-sm font-medium text-slate-800">{request.title}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-200/60 bg-amber-50 px-1.5 py-0.5 font-bold text-amber-950">
                    <Zap
                      className="h-3 w-3 fill-amber-400 text-amber-500"
                      aria-hidden
                    />
                    {request.requested_reward_points} E diminta
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Clock className="h-3 w-3" aria-hidden />
                    Menunggu tinjauan
                  </span>
                </div>
                {request.note ? (
                  <p className="text-xs text-slate-500">&ldquo;{request.note}&rdquo;</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => openApproveDialog(request)}
                  className="gap-1"
                >
                  <Check className="h-4 w-4" aria-hidden />
                  Setujui
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleReject(request.id)}
                  className="gap-1 border-red-200 text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Tolak
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={approveId !== null} onOpenChange={(open) => !open && closeApproveDialog()}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-center text-lg font-bold">
              Setujui Pengajuan Misi
            </DialogTitle>
            <DialogDescription className="text-center text-xs">
              {selectedRequest
                ? `${selectedRequest.child_name} mengajukan: "${selectedRequest.title}"`
                : "Konfirmasi detail misi sebelum ditambahkan."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="approve-reward" className="text-xs font-bold">
                Energi Reward
              </Label>
              <Input
                id="approve-reward"
                type="number"
                min={1}
                max={100}
                value={rewardPoints}
                onChange={(e) => setRewardPoints(e.target.value)}
                className="h-9 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Kategori</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    data-compact
                    onClick={() => setCategory(opt.value)}
                    className={cn(
                      "rounded-lg border p-2 text-[10px] font-semibold transition-colors cursor-pointer",
                      category === opt.value
                        ? "border-violet-500 bg-violet-50 text-violet-800 ring-1 ring-violet-500/20"
                        : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              onClick={handleApprove}
              disabled={isPending}
              className="h-10 w-full rounded-xl bg-violet-700 font-bold hover:bg-violet-800"
            >
              {isPending ? "Menyimpan..." : "Buat Misi & Setujui"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
