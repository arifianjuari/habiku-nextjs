"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ParentDashboardActivity } from "@/lib/parent/fetch-parent-dashboard";

type ParentActivityFeedProps = {
  activities: ParentDashboardActivity[];
};

function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const time = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return `Hari ini, ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return `Kemarin, ${time}`;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ParentActivityFeed({ activities }: ParentActivityFeedProps) {
  const visibleActivities = activities.slice(0, 4);
  const hasMore = activities.length > visibleActivities.length;

  return (
    <section aria-labelledby="parent-activity-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="parent-activity-heading"
          className="font-heading text-base font-extrabold text-foreground flex items-center gap-2"
        >
          <History className="h-5 w-5 text-muted-foreground" aria-hidden />
          Aktivitas Terkini
        </h2>
        {activities.length > 0 && (
          <Link
            href="/parent/queue"
            className="inline-flex min-h-11 items-center gap-0.5 text-xs font-bold text-primary hover:text-primary/80"
          >
            Lihat semua
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>

      <Card className="rounded-3xl border-border/80 bg-card/80 shadow-sm backdrop-blur-md">
        <CardContent className="p-4 sm:p-5">
          {activities.length > 0 ? (
            <ul className="relative space-y-5 border-l border-border pl-4">
              {visibleActivities.map((act, index) => {
                const isApproved = act.status === "approved";
                const isRejected = act.status === "rejected";
                const isPending = act.status === "pending";
                const taskTitle = act.task?.title || "Misi";
                const childName = act.child?.name || "Anak";

                return (
                  <motion.li
                    key={act.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.2 }}
                    className="relative"
                  >
                    <span
                      className="absolute left-[-21px] flex h-5 w-5 items-center justify-center rounded-full border bg-background shadow-sm"
                      aria-hidden
                    >
                      {isApproved ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : isRejected ? (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </span>

                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-foreground leading-snug">
                          <span className="text-primary">{childName}</span>
                          {" · "}
                          {isPending ? "mengirim bukti" : "menyelesaikan"}{" "}
                          <span className="font-black">&ldquo;{taskTitle}&rdquo;</span>
                        </p>
                        <time
                          dateTime={act.completed_at}
                          className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap"
                        >
                          {formatActivityTime(act.completed_at)}
                        </time>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-muted-foreground line-clamp-1 flex-1">
                          {act.notes?.trim() || "Tanpa catatan tambahan"}
                        </p>
                        <Badge
                          className={cn(
                            "shrink-0 border-none text-[9px] font-extrabold rounded-full",
                            isApproved && "bg-emerald-50 text-emerald-700",
                            isRejected && "bg-red-50 text-red-700",
                            isPending && "bg-amber-50 text-amber-800",
                          )}
                        >
                          {isApproved
                            ? `+${act.task?.reward_points ?? 0} E`
                            : isRejected
                              ? "Ditolak"
                              : "Perlu review"}
                        </Badge>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          ) : null}

          {hasMore && (
            <Link
              href="/parent/queue"
              className="mt-4 flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border/70 bg-muted/30 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              Lihat {activities.length - visibleActivities.length} aktivitas lainnya
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}

          {activities.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
              <Sparkles className="h-7 w-7 text-muted-foreground/40" aria-hidden />
              <p className="text-xs font-semibold text-muted-foreground">
                Belum ada riwayat aktivitas
              </p>
              <p className="text-[10px] text-muted-foreground max-w-[240px] text-pretty">
                Bukti misi yang dikirim anak akan muncul di sini secara realtime setelah
                mereka menyelesaikan tugas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
