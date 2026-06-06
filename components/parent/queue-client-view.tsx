"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Check,
  X,
  FileText,
  Zap,
  Target,
  AlertTriangle,
  Clock,
  Sparkles,
  BookOpen,
  GraduationCap,
  Activity,
  HelpCircle,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { approveTaskHistoryAction, rejectTaskHistoryAction } from "@/app/parent/queue/actions";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { SupabaseImage } from "@/components/shared/supabase-image";
import { useParentListCache } from "@/lib/hooks/use-parent-list-cache";
import { parentQueryKeys } from "@/lib/parent/query-keys";
import {
  buildParentChildCardHeaderWash,
  resolveHomeCardAccent,
} from "@/lib/child/resolve-home-card-accent";
import { cn } from "@/lib/utils";
import type { ChildProfile, Goal, Task } from "@/types/database";

interface QueueItem {
  id: string;
  task_id: string;
  profile_id: string;
  notes: string | null;
  evidence_url: string | null;
  completed_at: string;
  child: ChildProfile;
  task: Task;
  childGoals: Goal[];
}

interface QueueClientViewProps {
  initialQueueItems: QueueItem[];
}

function parseAINotes(rawNotes: string | null): {
  childNotes: string | null;
  aiData: { status: "matched" | "unmatched"; confidence: number; analysis: string } | null;
} {
  if (!rawNotes) return { childNotes: null, aiData: null };

  const startTag = "[AI_VERIFICATION_JSON_START]";
  const endTag = "[AI_VERIFICATION_JSON_END]";

  const startIndex = rawNotes.indexOf(startTag);
  const endIndex = rawNotes.indexOf(endTag);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    try {
      const jsonStr = rawNotes.substring(startIndex + startTag.length, endIndex);
      const aiData = JSON.parse(jsonStr);
      const childNotes = rawNotes
        .replace(rawNotes.substring(startIndex, endIndex + endTag.length), "")
        .trim();

      return { childNotes: childNotes || null, aiData };
    } catch (e) {
      console.error("Failed to parse AI JSON from notes:", e);
    }
  }

  return { childNotes: rawNotes, aiData: null };
}

const CATEGORY_STYLES = {
  ibadah: {
    iconBg: "bg-violet-500",
    label: "Ibadah",
    icon: BookOpen,
  },
  belajar: {
    iconBg: "bg-blue-500",
    label: "Belajar",
    icon: GraduationCap,
  },
  kebersihan: {
    iconBg: "bg-emerald-500",
    label: "Kebersihan",
    icon: Sparkles,
  },
  olahraga: {
    iconBg: "bg-amber-500",
    label: "Olahraga",
    icon: Activity,
  },
  lainnya: {
    iconBg: "bg-slate-500",
    label: "Lainnya",
    icon: HelpCircle,
  },
} as const;

function formatQueueTime(timeString: string): string {
  try {
    const date = new Date(timeString);
    return (
      date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    );
  } catch {
    return "Waktu tidak valid";
  }
}

type QueueMissionCardProps = {
  item: QueueItem;
  selectedGoalId: string;
  isPending: boolean;
  onGoalChange: (goalId: string) => void;
  onReject: () => void;
  onApprove: () => void;
  onPreviewEvidence: (url: string) => void;
};

function QueueMissionCard({
  item,
  selectedGoalId,
  isPending,
  onGoalChange,
  onReject,
  onApprove,
  onPreviewEvidence,
}: QueueMissionCardProps) {
  const style = CATEGORY_STYLES[item.task.category as keyof typeof CATEGORY_STYLES] ?? CATEGORY_STYLES.lainnya;
  const Icon = style.icon;
  const activeChildGoals = item.childGoals.filter((g) => g.status === "active");
  const hasActiveGoals = activeChildGoals.length > 0;
  const accentColor = resolveHomeCardAccent(item.child.home_card_accent, {
    gender: item.child.gender,
  });
  const { childNotes, aiData } = parseAINotes(item.notes);

  return (
    <article className="flex w-full min-w-0 flex-col overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-border/60">
      <div
        className="flex items-start gap-3 px-4 pb-3 pt-4"
        style={{ background: buildParentChildCardHeaderWash(accentColor) }}
      >
        <ChildAvatar
          name={item.child.name}
          avatarUrl={item.child.avatar_url}
          avatarPreference={item.child.avatar_preference}
          avatarEmoji={item.child.avatar_emoji}
          accentColor={accentColor}
          className="size-11 shrink-0 rounded-2xl ring-2 ring-white/80 shadow-sm"
          fallbackSizeClass="text-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-heading text-sm font-bold text-foreground">
                {item.child.name}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3.5 shrink-0" aria-hidden />
                {formatQueueTime(item.completed_at)}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-sm font-black tabular-nums text-amber-950 ring-1 ring-amber-300/50">
              <Zap className="size-4 fill-amber-500 text-amber-500" aria-hidden />
              +{item.task.reward_points}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-border/50 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-xl text-white",
              style.iconBg,
            )}
            aria-hidden
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {style.label}
            </p>
            <p className="text-sm font-semibold leading-snug text-foreground text-pretty">
              {item.task.title}
            </p>
          </div>
        </div>

        {(aiData || childNotes || item.evidence_url) && (
          <div className="flex gap-3">
            {item.evidence_url ? (
              <button
                type="button"
                onClick={() => onPreviewEvidence(item.evidence_url!)}
                className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted ring-1 ring-foreground/5"
                aria-label="Lihat bukti foto"
              >
                <SupabaseImage
                  src={item.evidence_url}
                  alt="Bukti misi"
                  fill
                  className="object-cover"
                  sizes="80px"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Eye className="size-5 text-white" aria-hidden />
                </span>
              </button>
            ) : null}
            <div className="min-w-0 flex-1 space-y-2">
              {aiData ? (
                <div className="rounded-2xl border border-violet-200/70 bg-violet-50/50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[11px] font-bold text-violet-800">
                      <Sparkles className="size-3.5 text-violet-600" aria-hidden />
                      AI {aiData.confidence}%
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        aiData.status === "matched"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800",
                      )}
                    >
                      {aiData.status === "matched" ? "Sesuai" : "Perlu cek"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground line-clamp-3">
                    {aiData.analysis}
                  </p>
                </div>
              ) : null}
              {childNotes ? (
                <div className="flex gap-2 rounded-2xl border border-border/70 bg-muted/40 px-3 py-2">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="text-xs italic leading-snug text-foreground/80 line-clamp-3">
                    &ldquo;{childNotes}&rdquo;
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {hasActiveGoals ? (
          <div className="space-y-1.5">
            <Label
              htmlFor={`goal-${item.id}`}
              className="flex items-center gap-1.5 text-xs font-bold text-foreground"
            >
              <Target className="size-3.5 text-violet-600" aria-hidden />
              Target hadiah
            </Label>
            <select
              id={`goal-${item.id}`}
              value={selectedGoalId}
              onChange={(e) => onGoalChange(e.target.value)}
              className="flex h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm font-medium focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {activeChildGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title} ({goal.current_hp}/{goal.target_hp} HP)
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 px-3 py-2.5 text-xs leading-snug text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            <p>
              <span className="font-bold">Belum ada target aktif.</span> Poin masuk ke saldo
              ledger anak.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border/50 bg-muted/20 p-3">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onReject}
          className="h-11 rounded-xl border-red-200 bg-card text-sm font-bold text-red-700 hover:bg-red-50"
        >
          <X className="size-4" aria-hidden />
          Tolak
        </Button>
        <Button
          type="button"
          disabled={isPending}
          onClick={onApprove}
          className="h-11 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
        >
          <Check className="size-4" aria-hidden />
          Setujui
        </Button>
      </div>
    </article>
  );
}

export function QueueClientView({ initialQueueItems }: QueueClientViewProps) {
  const router = useRouter();
  const familyId = initialQueueItems[0]?.child.family_id ?? "default";
  const [items, setItems] = useParentListCache<QueueItem[]>(
    parentQueryKeys.queue(familyId),
    initialQueueItems,
  );
  const [isPending, startTransition] = useTransition();
  const [selectedGoalIds, setSelectedGoalIds] = useState<Record<string, string>>({});
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialQueueItems);
  }, [initialQueueItems, setItems]);

  useEffect(() => {
    const initialSelections: Record<string, string> = {};
    initialQueueItems.forEach((item) => {
      const activeGoalsForChild = item.childGoals.filter((g) => g.status === "active");
      if (activeGoalsForChild.length > 0) {
        initialSelections[item.id] = activeGoalsForChild[0].id;
      }
    });

    setSelectedGoalIds((prev) => {
      const next = { ...prev };
      for (const [id, goalId] of Object.entries(initialSelections)) {
        if (!next[id]) next[id] = goalId;
      }
      return next;
    });
  }, [initialQueueItems]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("task-queue-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_history" },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const handleApprove = (itemId: string, childGoals: Goal[]) => {
    const activeGoals = childGoals.filter((g) => g.status === "active");
    const chosenGoalId = selectedGoalIds[itemId] || (activeGoals.length > 0 ? activeGoals[0].id : null);

    if (activeGoals.length > 0 && !chosenGoalId) {
      toast.error("Silakan pilih target hadiah terlebih dahulu.");
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== itemId));

    startTransition(async () => {
      const res = await approveTaskHistoryAction(itemId, chosenGoalId);
      if (res?.error) {
        toast.error(res.error);
        router.refresh();
      } else {
        toast.success("Misi disetujui! Poin energi disalurkan.");
      }
    });
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItemId) return;
    if (!rejectionReason.trim()) {
      setRejectionError("Alasan penolakan wajib diisi.");
      return;
    }

    const itemId = rejectingItemId;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setRejectingItemId(null);

    startTransition(async () => {
      const res = await rejectTaskHistoryAction(itemId, rejectionReason);
      if (res?.error) {
        toast.error(res.error);
        router.refresh();
      } else {
        toast.success("Misi ditolak. Anak akan mendapatkan notifikasi revisi.");
      }
      setRejectionReason("");
      setRejectionError(null);
    });
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden pb-2">
      <ParentPageHeaderSync
        title={`Persetujuan Misi (${items.length})`}
        description="Tinjau hasil misi anak dan berikan poin energi (E)."
        backHref="/parent"
        backLabel="Kembali ke beranda"
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Check className="size-7" aria-hidden />
          </div>
          <div className="space-y-1">
            <h3 className="font-heading text-base font-bold text-foreground">Antrean bersih</h3>
            <p className="max-w-xs text-sm text-muted-foreground text-pretty">
              Semua misi anak sudah ditinjau. Bagus sekali!
            </p>
          </div>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <QueueMissionCard
                item={item}
                selectedGoalId={selectedGoalIds[item.id] || ""}
                isPending={isPending}
                onGoalChange={(goalId) =>
                  setSelectedGoalIds((prev) => ({ ...prev, [item.id]: goalId }))
                }
                onReject={() => {
                  setRejectingItemId(item.id);
                  setRejectionReason("");
                  setRejectionError(null);
                }}
                onApprove={() => handleApprove(item.id, item.childGoals)}
                onPreviewEvidence={setPreviewImageUrl}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={rejectingItemId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingItemId(null);
            setRejectionReason("");
            setRejectionError(null);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-3xl border border-red-100 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-center font-heading text-base font-bold text-red-700">
              <AlertTriangle className="size-4" aria-hidden />
              Tolak pengajuan misi
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground">
              Berikan saran koreksi atau alasan mengapa tugas perlu direvisi.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRejectSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="rejectionReason" className="text-sm font-bold">
                Saran revisi
              </Label>
              <textarea
                id="rejectionReason"
                rows={4}
                placeholder="Misal: Bukti fotonya kurang jelas, tolong foto ulang ya..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="flex w-full rounded-xl border border-border bg-background p-3 text-sm placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>

            {rejectionError ? (
              <p
                className="rounded-xl border border-red-100 bg-red-50 p-2 text-center text-sm font-semibold text-red-700"
                role="alert"
              >
                {rejectionError}
              </p>
            ) : null}

            <DialogFooter className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectingItemId(null)}
                className="h-11 rounded-xl"
              >
                Kembali
              </Button>
              <Button type="submit" className="h-11 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700">
                Kirim tolak
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewImageUrl !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewImageUrl(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-1rem)] gap-3 rounded-3xl p-2 sm:max-w-md">
          {previewImageUrl ? (
            <div className="relative aspect-[3/4] max-h-[70vh] w-full overflow-hidden rounded-2xl bg-slate-950">
              <SupabaseImage
                src={previewImageUrl}
                alt="Bukti misi"
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>
          ) : null}
          <Button
            type="button"
            onClick={() => setPreviewImageUrl(null)}
            className="h-11 w-full rounded-xl bg-slate-900 font-bold text-white hover:bg-slate-800"
          >
            Tutup bukti
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
