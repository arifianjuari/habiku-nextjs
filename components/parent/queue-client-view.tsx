"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Check,
  X,
  FileText,
  Image as ImageIcon,
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
import { approveTaskHistoryAction, rejectTaskHistoryAction } from "@/app/parent/queue/actions";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";
import { SupabaseImage } from "@/components/shared/supabase-image";
import { useParentListCache } from "@/lib/hooks/use-parent-list-cache";
import { parentQueryKeys } from "@/lib/parent/query-keys";
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
      
      // Clean up child notes to remove the AI JSON part
      let childNotes = rawNotes.replace(rawNotes.substring(startIndex, endIndex + endTag.length), "").trim();
      
      return {
        childNotes: childNotes || null,
        aiData,
      };
    } catch (e) {
      console.error("Failed to parse AI JSON from notes:", e);
    }
  }

  return { childNotes: rawNotes, aiData: null };
}

const CATEGORY_STYLES = {
  ibadah: {
    iconBg: "bg-violet-500",
    text: "text-violet-700",
    label: "Ibadah",
    icon: BookOpen,
  },
  belajar: {
    iconBg: "bg-blue-500",
    text: "text-blue-700",
    label: "Belajar",
    icon: GraduationCap,
  },
  kebersihan: {
    iconBg: "bg-emerald-500",
    text: "text-emerald-700",
    label: "Kebersihan",
    icon: Sparkles,
  },
  olahraga: {
    iconBg: "bg-amber-500",
    text: "text-amber-700",
    label: "Olahraga",
    icon: Activity,
  },
  lainnya: {
    iconBg: "bg-slate-500",
    text: "text-slate-700",
    label: "Lainnya",
    icon: HelpCircle,
  },
};

export function QueueClientView({ initialQueueItems }: QueueClientViewProps) {
  const router = useRouter();
  const familyId = initialQueueItems[0]?.child.family_id ?? "default";
  const [items, setItems] = useParentListCache<QueueItem[]>(
    parentQueryKeys.queue(familyId),
    initialQueueItems,
  );
  const [isPending, startTransition] = useTransition();

  // Active Goals Selection States (taskId -> goalId mapping)
  const [selectedGoalIds, setSelectedGoalIds] = useState<Record<string, string>>({});

  // Rejection Dialog States
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  // Evidence Preview Dialog States
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Sync state with props
  useEffect(() => {
    setItems(initialQueueItems);
    
    // Auto-select the first active goal for each child profile
    const initialSelections: Record<string, string> = {};
    initialQueueItems.forEach((item) => {
      const activeGoalsForChild = item.childGoals.filter((g) => g.status === "active");
      if (activeGoalsForChild.length > 0 && !selectedGoalIds[item.id]) {
        initialSelections[item.id] = activeGoalsForChild[0].id;
      }
    });

    if (Object.keys(initialSelections).length > 0) {
      setSelectedGoalIds((prev) => ({ ...prev, ...initialSelections }));
    }
  }, [initialQueueItems]);

  // Supabase Realtime Subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("task-queue-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_history",
        },
        () => {
          // Refresh the Server Component data dynamically
          router.refresh();
        }
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

    // Optimistic UI update
    setItems((prev) => prev.filter((i) => i.id !== itemId));

    startTransition(async () => {
      const res = await approveTaskHistoryAction(itemId, chosenGoalId);
      if (res?.error) {
        toast.error(res.error);
        router.refresh(); // Rollback & fetch fresh data
      } else {
        toast.success("Misi disetujui! Poin energi disalurkan. 🎉");
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
    // Optimistic UI update
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setRejectingItemId(null);

    startTransition(async () => {
      const res = await rejectTaskHistoryAction(itemId, rejectionReason);
      if (res?.error) {
        toast.error(res.error);
        router.refresh(); // Rollback
      } else {
        toast.success("Misi ditolak. Anak akan mendapatkan notifikasi revisi.");
      }
      setRejectionReason("");
      setRejectionError(null);
    });
  };

  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB";
    } catch {
      return "Waktu tidak valid";
    }
  };

  return (
    <div className="space-y-4">
      <ParentPageHeaderSync
        title={`Persetujuan Misi (${items.length})`}
        description="Tinjau hasil misi anak dan berikan poin energi (E)."
      />

      <AnimatePresence mode="popLayout">
        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 backdrop-blur-sm space-y-4"
          >
            <div className="rounded-full bg-emerald-50 p-4 border border-emerald-100">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">Antrean Bersih! ✨</h3>
              <p className="text-xs text-slate-500 max-w-[260px]">
                Semua misi anak sudah ditinjau. Bagus sekali papa/mama!
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="grid gap-2.5">
            {items.map((item) => {
              const style = CATEGORY_STYLES[item.task.category] || CATEGORY_STYLES.lainnya;
              const Icon = style.icon;
              const activeChildGoals = item.childGoals.filter((g) => g.status === "active");
              const hasActiveGoals = activeChildGoals.length > 0;
              const childAccent = item.child.home_card_accent || "#8B5CF6";
              const { childNotes, aiData } = parseAINotes(item.notes);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card
                    size="sm"
                    className="gap-0 overflow-hidden rounded-2xl border border-slate-150 bg-white !py-0 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="h-0.5 w-full" style={{ backgroundColor: childAccent }} />

                    <CardContent className="space-y-1.5 !px-2.5 !py-1.5">
                      {/* Header: anak, misi, dan reward dalam satu baris kompak */}
                      <div className="flex items-start gap-2">
                        <ChildAvatar
                          name={item.child.name}
                          avatarUrl={item.child.avatar_url}
                          avatarPreference={item.child.avatar_preference}
                          avatarEmoji={item.child.avatar_emoji}
                          accentColor={childAccent}
                          className="h-7 w-7 shrink-0 rounded-full shadow-sm"
                          fallbackSizeClass="text-[10px]"
                        />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold leading-tight text-slate-900">
                                {item.child.name}
                              </p>
                              <p className="flex items-center gap-1 text-[9px] text-slate-400">
                                <Clock className="h-2.5 w-2.5 shrink-0" />
                                {formatTime(item.completed_at)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-amber-200/50 bg-amber-50 px-1.5 py-0.5">
                              <Zap className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                              <span className="text-[10px] font-extrabold text-amber-950">
                                +{item.task.reward_points} E
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white ${style.iconBg}`}
                            >
                              <Icon className="h-3 w-3" />
                            </div>
                            <p className="min-w-0 truncate text-xs font-semibold text-slate-800">
                              <span className="font-medium text-slate-500">{style.label} · </span>
                              {item.task.title}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Bukti, catatan, dan AI — baris horizontal kompak */}
                      {(aiData || childNotes || item.evidence_url) && (
                        <div className="flex gap-2">
                          {item.evidence_url && (
                            <button
                              type="button"
                              onClick={() => setPreviewImageUrl(item.evidence_url)}
                              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-100"
                              aria-label="Lihat bukti foto"
                            >
                              <SupabaseImage
                                src={item.evidence_url}
                                alt="Bukti Misi"
                                fill
                                className="object-cover"
                                sizes="56px"
                              />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity hover:opacity-100">
                                <Eye className="h-3.5 w-3.5 text-white" />
                              </span>
                            </button>
                          )}
                          <div className="min-w-0 flex-1 space-y-1.5">
                            {aiData && (
                              <div className="rounded-lg border border-violet-100 bg-violet-50/40 px-2 py-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-violet-800">
                                    <Sparkles className="h-3 w-3 text-violet-600" />
                                    AI {aiData.confidence}%
                                  </span>
                                  <span
                                    className={`shrink-0 rounded-full px-1.5 py-px text-[8px] font-bold uppercase ${
                                      aiData.status === "matched"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-amber-50 text-amber-700"
                                    }`}
                                  >
                                    {aiData.status === "matched" ? "Sesuai" : "Perlu cek"}
                                  </span>
                                </div>
                                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-600">
                                  {aiData.analysis}
                                </p>
                              </div>
                            )}
                            {childNotes && (
                              <div className="flex gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1">
                                <FileText className="mt-px h-3 w-3 shrink-0 text-slate-400" />
                                <p className="line-clamp-2 text-[10px] italic leading-snug text-slate-600">
                                  &ldquo;{childNotes}&rdquo;
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Target hadiah */}
                      {hasActiveGoals ? (
                        <div className="rounded-lg border border-violet-100/60 bg-violet-50/25 px-2 py-1">
                          <Label
                            htmlFor={`goal-${item.id}`}
                            className="mb-0.5 flex items-center gap-1 text-[9px] font-bold text-violet-900"
                          >
                            <Target className="h-3 w-3 text-violet-700" />
                            Target hadiah
                          </Label>
                          <select
                            id={`goal-${item.id}`}
                            value={selectedGoalIds[item.id] || ""}
                            onChange={(e) =>
                              setSelectedGoalIds((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            className="flex h-8 w-full rounded-lg border border-violet-100 bg-white px-2 text-[11px] font-medium ring-offset-background placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-700"
                          >
                            {activeChildGoals.map((goal) => (
                              <option key={goal.id} value={goal.id}>
                                {goal.title} ({goal.current_hp}/{goal.target_hp} HP)
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-start gap-1.5 rounded-lg border border-dashed border-amber-200 bg-amber-50/20 px-2 py-1 text-[9px] leading-snug text-amber-800">
                          <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-amber-500" />
                          <p>
                            <span className="font-bold">Belum ada target aktif.</span>{" "}
                            Poin masuk ke saldo ledger anak.
                          </p>
                        </div>
                      )}

                      {/* Aksi */}
                      <div className="flex gap-1.5">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setRejectingItemId(item.id);
                            setRejectionReason("");
                            setRejectionError(null);
                          }}
                          className="h-8 flex-1 rounded-lg border border-red-200 text-xs hover:bg-red-50"
                        >
                          <X className="mr-0.5 h-3 w-3" />
                          Tolak
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(item.id, item.childGoals)}
                          className="h-8 flex-1 rounded-lg bg-emerald-600 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                        >
                          <Check className="mr-0.5 h-3 w-3" />
                          Setujui
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Rejection Dialog Popover */}
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
        <DialogContent className="max-w-xs rounded-3xl border border-red-100 bg-white/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-base font-bold text-center flex items-center justify-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Tolak Pengajuan Misi
            </DialogTitle>
            <DialogDescription className="text-center text-[11px] text-slate-500">
              Berikan saran koreksi/alasan mengapa tugas perlu direvisi.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRejectSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="rejectionReason" className="text-xs font-bold text-slate-800">Saran Revisi Papa / Mama</Label>
              <textarea
                id="rejectionReason"
                rows={3}
                placeholder="Misal: Bukti fotonya kurang jelas sayang, tolong foto ulang ya..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="flex w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-medium"
                required
              />
            </div>

            {rejectionError && (
              <p className="text-xs font-semibold text-red-600 text-center bg-red-50 p-2 rounded-lg border border-red-100" role="alert">
                {rejectionError}
              </p>
            )}

            <DialogFooter className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectingItemId(null)}
                className="flex-1 rounded-xl h-10 border-slate-200 hover:bg-slate-50"
              >
                Kembali
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-red-600 hover:bg-red-750 text-white font-bold h-10 rounded-xl"
              >
                Kirim Tolak
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Evidence Preview Dialog */}
      <Dialog
        open={previewImageUrl !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewImageUrl(null);
        }}
      >
        <DialogContent className="max-w-md rounded-3xl border border-violet-100 bg-white p-2 shadow-2xl overflow-hidden">
          {previewImageUrl && (
            <div className="relative h-[70vh] w-full overflow-hidden rounded-2xl bg-slate-950">
              <SupabaseImage
                src={previewImageUrl}
                alt="Bukti Misi Fullscreen"
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>
          )}
          <DialogFooter className="px-2 pt-2 pb-1">
            <Button
              onClick={() => setPreviewImageUrl(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 rounded-xl"
            >
              Tutup Bukti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
