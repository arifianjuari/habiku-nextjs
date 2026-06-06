"use client";

import Link from "next/link";
import {
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParentDashboardActivity } from "@/lib/parent/parent-home-data";

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

const STATUS_STYLES = {
  approved: {
    icon: CheckCircle2,
    ring: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    badge: "bg-emerald-50 text-emerald-700",
  },
  rejected: {
    icon: AlertCircle,
    ring: "bg-red-50 text-red-600 ring-red-100",
    badge: "bg-red-50 text-red-700",
  },
  pending: {
    icon: Clock,
    ring: "bg-amber-50 text-amber-600 ring-amber-100",
    badge: "bg-amber-50 text-amber-800",
  },
} as const;

export function ParentActivityFeed({ activities }: ParentActivityFeedProps) {
  const visibleActivities = activities.slice(0, 4);
  const remaining = activities.length - visibleActivities.length;

  return (
    <section aria-labelledby="parent-activity-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="parent-activity-heading"
          className="flex items-center gap-2 font-heading text-base font-extrabold text-foreground"
        >
          <History className="size-[18px] text-muted-foreground" aria-hidden />
          Aktivitas Terkini
        </h2>
        {activities.length > 0 && (
          <Link
            href="/parent/queue"
            className="inline-flex min-h-11 items-center gap-0.5 text-xs font-bold text-primary hover:text-primary/80"
          >
            Lihat semua
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>

      {activities.length > 0 ? (
        <ul className="space-y-2">
          {visibleActivities.map((act) => {
            const statusKey = (
              act.status === "approved" || act.status === "rejected"
                ? act.status
                : "pending"
            ) as keyof typeof STATUS_STYLES;
            const style = STATUS_STYLES[statusKey];
            const StatusIcon = style.icon;
            const taskTitle = act.task?.title || "Misi";
            const childName = act.child?.name || "Anak";

            return (
              <li
                key={act.id}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm ring-1 ring-foreground/5"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl ring-1",
                    style.ring,
                  )}
                  aria-hidden
                >
                  <StatusIcon className="size-[18px]" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold leading-tight text-foreground">
                    <span className="text-primary">{childName}</span>{" "}
                    <span className="font-medium text-muted-foreground">
                      {statusKey === "pending"
                        ? "mengirim bukti"
                        : statusKey === "approved"
                          ? "menyelesaikan"
                          : "ditolak pada"}
                    </span>
                  </p>
                  <p className="truncate text-xs text-foreground/80">{taskTitle}</p>
                  <time
                    dateTime={act.completed_at}
                    className="text-[10px] text-muted-foreground"
                    suppressHydrationWarning
                  >
                    {formatActivityTime(act.completed_at)}
                  </time>
                </div>

                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold",
                    style.badge,
                  )}
                >
                  {statusKey === "approved"
                    ? `+${act.task?.reward_points ?? 0} E`
                    : statusKey === "rejected"
                      ? "Ditolak"
                      : "Review"}
                </span>
              </li>
            );
          })}

          {remaining > 0 && (
            <li>
              <Link
                href="/parent/queue"
                className="flex min-h-11 items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-muted/30 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                Lihat {remaining} aktivitas lainnya
                <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            </li>
          )}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
            <Sparkles className="size-6" aria-hidden />
          </div>
          <p className="text-sm font-bold text-foreground">Belum ada aktivitas</p>
          <p className="max-w-[240px] text-pretty text-xs text-muted-foreground">
            Bukti misi yang dikirim anak akan muncul di sini secara realtime.
          </p>
        </div>
      )}
    </section>
  );
}
