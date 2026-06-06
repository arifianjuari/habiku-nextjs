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
import {
  formatMaxSubmissionsFieldLabel,
  formatMaxSubmissionsLabel,
  getFrequencyDisplayLabel,
  normalizeFrequencyForParentForm,
  PARENT_FREQUENCY_OPTIONS,
  type ParentFrequencyType,
} from "@/lib/tasks/mission-frequency";

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
  const [frequencyType, setFrequencyType] = useState<ParentFrequencyType>("daily");
  const [maxSubmissionsPerPeriod, setMaxSubmissionsPerPeriod] = useState("1");
  const [category, setCategory] = useState<TaskCategory>("lainnya");

  const selectedRequest = requests.find((r) => r.id === approveId) ?? null;

  const openApproveDialog = (request: PendingTaskRequest) => {
    setApproveId(request.id);
    setRewardPoints(String(request.requested_reward_points));
    setFrequencyType(
      normalizeFrequencyForParentForm(request.requested_frequency_type ?? "daily"),
    );
    setMaxSubmissionsPerPeriod(
      String(request.requested_max_submissions_per_period ?? 1),
    );
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
    const maxSubmissions = Number(maxSubmissionsPerPeriod);
    if (!Number.isFinite(reward) || reward < 1) {
      toast.error("Energi harus minimal 1.");
      return;
    }
    if (!Number.isFinite(maxSubmissions) || maxSubmissions < 1 || maxSubmissions > 20) {
      toast.error("Batas pengerjaan harus antara 1 dan 20.");
      return;
    }

    const previous = requests;
    onRequestsChange(requests.filter((r) => r.id !== approveId));

    startTransition(async () => {
      const res = await approveTaskRequestAction(
        approveId,
        reward,
        category,
        frequencyType,
        maxSubmissions,
      );
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
      <section className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-800">
          <Lightbulb className="h-3.5 w-3.5 text-amber-600" aria-hidden />
          Pengajuan misi dari anak ({requests.length})
        </p>
        <div className="flex flex-col gap-1.5 rounded-xl border border-amber-200 bg-amber-50/90 p-2">
          {requests.map((request) => {
            const freqType = request.requested_frequency_type ?? "daily";
            const meta = `${request.child_name} · ${getFrequencyDisplayLabel(freqType)} · ${formatMaxSubmissionsLabel(
              request.requested_max_submissions_per_period ?? 1,
              freqType,
            )}`;

            return (
              <div
                key={request.id}
                className="flex items-center gap-2 rounded-lg border border-amber-100 bg-white px-2 py-1.5"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500 text-white">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                </div>

                <div className="min-w-0 flex-1 leading-none">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="truncate text-[13px] font-bold text-slate-900">
                      {request.title}
                    </p>
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-black text-amber-800">
                      <Zap
                        className="h-2.5 w-2.5 fill-amber-500 text-amber-500"
                        aria-hidden
                      />
                      +{request.requested_reward_points}E
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[9px] font-medium text-slate-500">
                    {meta}
                  </p>
                  {request.note ? (
                    <p className="mt-0.5 truncate text-[8px] italic text-slate-400">
                      &ldquo;{request.note}&rdquo;
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[8px] font-semibold text-amber-600">
                      Menunggu tinjauan
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-1 self-center">
                  <Button
                    size="xs"
                    disabled={isPending}
                    onClick={() => openApproveDialog(request)}
                    className="h-6 min-h-0 rounded-md px-2 text-[9px] font-bold"
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="approve-frequency" className="text-xs font-bold">
                  Frekuensi
                </Label>
                <select
                  id="approve-frequency"
                  value={frequencyType}
                  onChange={(e) =>
                    setFrequencyType(e.target.value as ParentFrequencyType)
                  }
                  className="flex h-9 w-full rounded-xl border border-violet-100 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-700"
                >
                  {PARENT_FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="approve-max-submissions" className="text-xs font-bold">
                  {formatMaxSubmissionsFieldLabel(frequencyType)}
                </Label>
                <Input
                  id="approve-max-submissions"
                  type="number"
                  min={1}
                  max={20}
                  value={maxSubmissionsPerPeriod}
                  onChange={(e) => setMaxSubmissionsPerPeriod(e.target.value)}
                  className="h-9 rounded-xl"
                />
              </div>
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
