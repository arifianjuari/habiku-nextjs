"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Target, Play, ChevronRight } from "lucide-react";
import type { ChildProfile, Goal } from "@/types/database";
import { ChildAvatar } from "@/components/shared/child-avatar";
import { cn } from "@/lib/utils";

interface ChildCardProps {
  child: ChildProfile;
  activeGoal: Goal | null;
  points: number;
  className?: string;
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
  if (gender === "female") return "P";
  if (gender === "male") return "L";
  return "—";
}

export function ChildCard({ child, activeGoal, points, className }: ChildCardProps) {
  const router = useRouter();
  const enter = useChildModeStore((s) => s.enter);
  const age = getAge(child.date_of_birth);
  const accentColor = child.home_card_accent || "#8B5CF6";

  const goalPercent = activeGoal
    ? Math.min(100, (activeGoal.current_hp / activeGoal.target_hp) * 100)
    : 0;

  const handleEnterChildModeDirect = () => {
    enter(child.id, child.name);
    document.cookie = `habiku_child_mode=1; path=/; max-age=${60 * 60 * 24 * 7}`;
    router.push("/child/home");
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className={cn("flex h-full w-full", className)}
    >
      <Card
        size="sm"
        className="flex h-full min-h-[188px] w-full flex-col gap-0 overflow-hidden border bg-card/90 py-0 shadow-sm ring-foreground/8 transition-shadow hover:shadow-md"
        style={{ borderColor: `${accentColor}35` }}
      >
        <CardContent className="flex flex-1 flex-col gap-2.5 p-3">
          {/* Baris utama: avatar + nama + energi */}
          <div className="flex items-center gap-2.5">
            <ChildAvatar
              name={child.name}
              avatarUrl={child.avatar_url}
              avatarPreference={child.avatar_preference}
              avatarEmoji={child.avatar_emoji}
              accentColor={accentColor}
              className="h-10 w-10 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <h3
                className="font-heading truncate text-sm font-bold leading-tight text-foreground"
                title={child.name}
              >
                {child.name}
              </h3>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {age !== null ? `${age} th` : "—"} · {genderShort(child.gender)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-amber-200/60 bg-amber-50 px-2 py-1">
              <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-400" aria-hidden />
              <span className="text-xs font-extrabold text-amber-950 tabular-nums">{points}</span>
            </div>
          </div>

          {/* Target / placeholder — tinggi tetap agar kartu seragam */}
          <div className="flex min-h-[52px] flex-1 flex-col justify-center">
            {activeGoal ? (
              <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1 font-semibold text-foreground">
                    <Target className="h-3 w-3 shrink-0 text-rose-500" aria-hidden />
                    <span className="truncate">{activeGoal.title}</span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-foreground">
                    {activeGoal.current_hp}/{activeGoal.target_hp}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${goalPercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <Link
                href="/parent/targets"
                className="flex h-[52px] items-center justify-between gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-2.5 text-[11px] transition-colors hover:bg-muted/40"
              >
                <span className="text-muted-foreground">Belum ada target aktif</span>
                <span className="inline-flex shrink-0 items-center gap-0.5 font-bold text-primary">
                  Atur
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </span>
              </Link>
            )}
          </div>

          {/* Aksi */}
          <div className="mt-auto grid shrink-0 grid-cols-[1fr_auto] gap-1.5">
            <Button
              type="button"
              size="sm"
              onClick={handleEnterChildModeDirect}
              className={cn(
                "h-9 rounded-lg bg-slate-900 text-xs font-bold text-white hover:bg-slate-800",
                "shadow-none",
              )}
            >
              <Play className="h-3.5 w-3.5 fill-white" aria-hidden />
              Mode Anak
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push(`/parent/goal/${child.id}`)}
              className="h-9 rounded-lg px-3 text-xs font-bold"
            >
              Detail
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
