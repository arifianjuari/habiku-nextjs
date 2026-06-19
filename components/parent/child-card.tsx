"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { navigateToChildHomeAfterEnter } from "@/lib/child/enter-child-mode-navigation";
import { Button } from "@/components/ui/button";
import { Zap, Target, Play, ChevronRight } from "lucide-react";
import type { ChildProfile, Goal } from "@/types/database";
import { ChildAvatar } from "@/components/shared/child-avatar";
import {
  buildParentChildCardHeaderWash,
  buildParentChildCardProgressGradient,
  hexToRgbString,
  resolveHomeCardAccent,
} from "@/lib/child/resolve-home-card-accent";
import { cn } from "@/lib/utils";

interface ChildCardProps {
  child: ChildProfile;
  activeGoal: Goal | null;
  points: number;
  className?: string;
  /** Tampilan padat untuk carousel beranda */
  compact?: boolean;
}

function getAge(dobString: string | null): number | null {
  if (!dobString) return null;
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function genderShort(gender: ChildProfile["gender"]): string {
  if (gender === "female") return "Perempuan";
  if (gender === "male") return "Laki-laki";
  return "—";
}

export function ChildCard({
  child,
  activeGoal,
  points,
  className,
  compact = false,
}: ChildCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const enter = useChildModeStore((s) => s.enter);
  const [navPending, startNav] = useTransition();
  const age = getAge(child.date_of_birth);
  const accentColor = resolveHomeCardAccent(child.home_card_accent, {
    gender: child.gender,
  });
  const accentRgb = hexToRgbString(accentColor);

  const goalPercent = activeGoal
    ? Math.min(100, Math.round((activeGoal.current_hp / activeGoal.target_hp) * 100))
    : 0;

  const handleEnterChildModeDirect = () => {
    startNav(async () => {
      enter(child.id, child.name);
      await navigateToChildHomeAfterEnter(queryClient, child.id, router);
    });
  };

  const navigateTo = (href: string) => {
    startNav(() => {
      router.push(href);
    });
  };

  return (
    <article
      className={cn(
        "flex h-full w-full flex-col bg-card",
        compact
          ? "overflow-hidden rounded-2xl border border-border/60"
          : "overflow-hidden rounded-3xl shadow-md ring-1 ring-border/60",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center",
          compact ? "gap-2.5 px-3 py-2.5" : "gap-3 px-4 pb-3 pt-4",
        )}
        style={{ background: buildParentChildCardHeaderWash(accentColor) }}
      >
        <ChildAvatar
          name={child.name}
          avatarUrl={child.avatar_url}
          avatarPreference={child.avatar_preference}
          avatarEmoji={child.avatar_emoji}
          accentColor={accentColor}
          className={cn(
            "shrink-0 ring-2 ring-white/80 shadow-sm",
            compact ? "size-11 rounded-xl" : "size-14 rounded-2xl",
          )}
          fallbackSizeClass={compact ? "text-xs" : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={cn(
                "truncate font-heading font-extrabold leading-tight text-foreground",
                compact ? "text-sm" : "text-base",
              )}
              title={child.name}
            >
              {child.name}
            </h3>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-400/20 font-black tabular-nums text-amber-950 ring-1 ring-amber-300/50",
                compact ? "px-2 py-0.5 text-xs" : "gap-1 px-2.5 py-1 text-sm",
              )}
            >
              <Zap
                className={cn(
                  "fill-amber-500 text-amber-500",
                  compact ? "size-3.5" : "size-4",
                )}
                aria-hidden
              />
              {points}
            </span>
          </div>
          <p className={cn("text-muted-foreground", compact ? "text-[11px]" : "mt-0.5 text-xs")}>
            {age !== null ? `${age} tahun` : "Usia belum diisi"} · {genderShort(child.gender)}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "flex flex-col justify-center border-t border-border/50",
          compact ? "px-3 py-2" : "flex-1 px-4 py-3",
        )}
      >
        {activeGoal ? (
          <div className={cn(compact ? "space-y-1" : "space-y-2")}>
            {compact ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1 text-xs">
                  <Target className="size-3 shrink-0 text-rose-500" aria-hidden />
                  <span className="truncate font-bold text-foreground">{activeGoal.title}</span>
                  <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {activeGoal.current_hp}/{activeGoal.target_hp}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] font-black tabular-nums text-rose-700">
                  {goalPercent}%
                </span>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Target hadiah
                  </p>
                  <p className="flex items-center gap-1 truncate text-sm font-bold text-foreground">
                    <Target className="size-3.5 shrink-0 text-rose-500" aria-hidden />
                    {activeGoal.title}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-black tabular-nums text-rose-700">
                  {goalPercent}%
                </span>
              </div>
            )}
            <div
              className={cn(
                "w-full overflow-hidden rounded-full bg-muted",
                compact ? "h-1.5" : "h-2.5",
              )}
              role="progressbar"
              aria-valuenow={goalPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progres target ${activeGoal.title}: ${activeGoal.current_hp} dari ${activeGoal.target_hp} energi`}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${goalPercent}%`,
                  background: buildParentChildCardProgressGradient(accentColor),
                }}
              />
            </div>
            {!compact ? (
              <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
                {activeGoal.current_hp} / {activeGoal.target_hp} energi terkumpul
              </p>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => navigateTo("/parent/targets")}
            disabled={navPending}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-border text-left transition-colors hover:bg-muted/40",
              compact ? "px-2.5 py-2" : "rounded-2xl px-3 py-3",
            )}
          >
            <span className={cn("text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
              Belum ada target aktif
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 font-bold text-primary",
                compact ? "text-[11px]" : "text-xs",
              )}
            >
              Atur target
              <ChevronRight className="size-3.5" aria-hidden />
            </span>
          </button>
        )}
      </div>

      <div
        className={cn(
          "grid grid-cols-2 border-t border-border/50 bg-muted/20",
          compact ? "gap-1.5 p-1.5" : "gap-2 p-3",
        )}
      >
        <Button
          type="button"
          size="sm"
          data-compact={compact || undefined}
          disabled={navPending}
          onClick={handleEnterChildModeDirect}
          className={cn(
            "border-0 font-bold text-white shadow-sm",
            compact ? "h-8 rounded-lg px-2 text-[11px]" : "h-11 rounded-xl text-sm",
          )}
          style={{ backgroundColor: accentRgb }}
        >
          <Play className={cn("fill-white", compact ? "size-3" : "size-4")} aria-hidden />
          {navPending ? "Membuka…" : "Mode Anak"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-compact={compact || undefined}
          disabled={navPending}
          onClick={() => navigateTo(`/parent/goal/${child.id}`)}
          className={cn(
            "bg-card font-bold",
            compact ? "h-8 rounded-lg px-2 text-[11px]" : "h-11 rounded-xl text-sm",
          )}
        >
          {navPending ? "Membuka…" : compact ? "Detail" : "Lihat detail"}
        </Button>
      </div>
    </article>
  );
}
