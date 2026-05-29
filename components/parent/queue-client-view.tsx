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
  const [items, setItems] = useState<QueueItem[]>(initialQueueItems);
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
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Persetujuan Misi ({items.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Tinjau hasil misi anak dan berikan poin energi (E).
          </p>
        </div>
      </div>

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
          <div className="grid gap-4">
            {items.map((item) => {
              const style = CATEGORY_STYLES[item.task.category] || CATEGORY_STYLES.lainnya;
              const Icon = style.icon;
              const activeChildGoals = item.childGoals.filter((g) => g.status === "active");
              const hasActiveGoals = activeChildGoals.length > 0;
              const childAccent = item.child.home_card_accent || "#8B5CF6";

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="overflow-hidden border border-slate-150 bg-white shadow-md hover:shadow-lg transition-all rounded-3xl">
                    {/* Header: Child name and accent strip */}
                    <div className="h-1.5 w-full" style={{ backgroundColor: childAccent }} />
                    
                    <CardContent className="p-4 space-y-4">
                      {/* Section 1: Anak & Waktu */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <ChildAvatar
                            name={item.child.name}
                            avatarUrl={item.child.avatar_url}
                            avatarPreference={item.child.avatar_preference}
                            avatarEmoji={item.child.avatar_emoji}
                            accentColor={childAccent}
                            className="h-8 w-8 shrink-0 rounded-full shadow-sm"
                            fallbackSizeClass="text-[11px]"
                          />
                          <div>
                            <span className="font-bold text-sm text-slate-900 block leading-tight">
                              {item.child.name}
                            </span>
                            <span className="text-[9px] text-slate-400 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              Selesai pukul {formatTime(item.completed_at)}
                            </span>
                          </div>
                        </div>

                        {/* Poin Reward */}
                        <div className="flex items-center gap-1 rounded-xl bg-amber-50 border border-amber-200/50 px-2 py-0.5 shadow-sm">
                          <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-extrabold text-amber-950">+{item.task.reward_points} E</span>
                        </div>
                      </div>

                      {/* Section 2: Detail Misi */}
                      <div className="space-y-2">
                        <div className="flex gap-2.5 items-start">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${style.iconBg} shadow-sm`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-slate-500 capitalize">
                              Misi {style.label}
                            </span>
                            <h4 className="font-bold text-sm text-slate-950 leading-snug">
                              {item.task.title}
                            </h4>
                          </div>
                        </div>

                        {/* Child notes & AI Verification */}
                        {(() => {
                          const { childNotes, aiData } = parseAINotes(item.notes);
                          return (
                            <div className="space-y-3">
                              {/* AI Verification Section */}
                              {aiData && (
                                <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-500/5 to-indigo-500/5 p-4 space-y-3 backdrop-blur-sm relative overflow-hidden">
                                  {/* Decorative shine */}
                                  <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-violet-400/10 blur-xl pointer-events-none" />
                                  
                                  <div className="flex items-center justify-between border-b border-violet-100/55 pb-2">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-violet-800 uppercase tracking-wider">
                                      <Sparkles className="h-3.5 w-3.5 text-violet-600 fill-violet-600 animate-pulse" />
                                      <span>🤖 Verifikasi AI Gemini</span>
                                    </div>
                                    
                                    {/* Status indicator */}
                                    <span className={`text-[9px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 ${
                                      aiData.status === "matched"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                        : "bg-amber-50 text-amber-700 border border-amber-100"
                                    }`}>
                                      {aiData.status === "matched" ? "Sesuai ✨" : "Butuh Perhatian ⚠️"}
                                    </span>
                                  </div>

                                  <div className="space-y-2">
                                    <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                                      {aiData.analysis}
                                    </p>

                                    {/* Confidence Bar */}
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                                        <span>Tingkat Kecocokan Visual</span>
                                        <span className="text-violet-700 font-extrabold">{aiData.confidence}%</span>
                                      </div>
                                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
                                          style={{ width: `${aiData.confidence}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Child notes */}
                              {childNotes && (
                                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-xs italic text-slate-700 flex gap-2">
                                  <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                  <span>&ldquo;{childNotes}&rdquo;</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Evidence image preview */}
                        {item.evidence_url && (
                          <div className="relative rounded-2xl overflow-hidden border border-slate-100 max-h-36 w-full bg-slate-100 flex items-center justify-center">
                            <img
                              src={item.evidence_url}
                              alt="Bukti Misi"
                              className="w-full h-full max-h-36 object-cover"
                            />
                            {/* Hover click mask to view fullscreen */}
                            <button
                              onClick={() => setPreviewImageUrl(item.evidence_url)}
                              className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200 cursor-pointer font-semibold text-xs gap-1.5"
                            >
                              <Eye className="h-4 w-4" />
                              Lihat Bukti Foto
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Section 3: Point Destination (Target) */}
                      {hasActiveGoals ? (
                        <div className="space-y-1.5 rounded-2xl bg-violet-50/30 border border-violet-100/50 p-3">
                          <Label
                            htmlFor={`goal-${item.id}`}
                            className="text-[10px] font-bold text-violet-950 flex items-center gap-1"
                          >
                            <Target className="h-3.5 w-3.5 text-violet-700" />
                            Salurkan Energi ke Target Hadiah:
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
                            className="flex w-full rounded-xl border border-violet-100 bg-white px-2.5 h-9 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-700 focus:border-transparent font-medium"
                          >
                            {activeChildGoals.map((goal) => (
                              <option key={goal.id} value={goal.id}>
                                {goal.title} ({goal.current_hp}/{goal.target_hp} HP)
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/20 p-2.5 flex gap-2 items-start text-[10px] text-amber-800">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-bold">Anak tidak memiliki target aktif!</span>
                            <span className="block">
                              Poin hanya akan disimpan di saldo ledger anak. Silakan buat target aktif di menu Target.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Section 4: Aksi Peninjauan */}
                      <div className="flex gap-2">
                        {/* Reject Trigger */}
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setRejectingItemId(item.id);
                            setRejectionReason("");
                            setRejectionError(null);
                          }}
                          className="flex-1 rounded-xl h-10 border border-red-200 hover:bg-red-50"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Tolak
                        </Button>

                        {/* Approve Button */}
                        <Button
                          onClick={() => handleApprove(item.id, item.childGoals)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-xl shadow-md"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Setujui Misi
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
            <div className="rounded-2xl overflow-hidden w-full max-h-[80vh] flex items-center justify-center bg-slate-950">
              <img
                src={previewImageUrl}
                alt="Bukti Misi Fullscreen"
                className="w-full h-auto max-h-[80vh] object-contain"
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
