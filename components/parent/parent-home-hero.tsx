"use client";

import Link from "next/link";
import { Users, Target, ListTodo, ChevronRight } from "lucide-react";
import { FamilySharedGoalHero } from "@/components/parent/family-shared-goal-hero";
import type { FamilySharedGoal } from "@/lib/parent/family-shared-goal";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ParentHomeHeroProps = {
  childrenCount: number;
  activeGoalsCount: number;
  totalTasksCount: number;
  isPrimaryParent: boolean;
  displayName?: string;
  timeGreeting?: string;
  sharedFamilyGoal: FamilySharedGoal;
};

type StatChipProps = {
  icon: ReactNode;
  value: number;
  label: string;
  href?: string;
  highlighted?: boolean;
  ariaLabel?: string;
};

function StatChip({ icon, value, label, href, highlighted, ariaLabel }: StatChipProps) {
  const className = cn(
    "flex min-w-0 flex-1 items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs transition-colors",
    highlighted
      ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80 hover:bg-amber-100/80"
      : "bg-muted/50 text-foreground hover:bg-muted/80",
  );

  const content = (
    <>
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-background/80">
        {icon}
      </span>
      <span className="font-black tabular-nums">{value}</span>
      <span className="truncate text-[10px] font-medium text-muted-foreground">{label}</span>
      {href ? <ChevronRight className="ml-auto size-3 shrink-0 opacity-40" aria-hidden /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

export function ParentHomeHero({
  childrenCount,
  activeGoalsCount,
  totalTasksCount,
  isPrimaryParent,
  displayName,
  timeGreeting,
  sharedFamilyGoal,
}: ParentHomeHeroProps) {
  return (
    <section
      className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm duration-500 animate-in fade-in slide-in-from-top-1"
      aria-label="Ringkasan energi dan statistik keluarga"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {displayName ? (
            <>
              <p className="text-[10px] font-medium text-muted-foreground">
                {timeGreeting ?? "Halo"},
              </p>
              <h1 className="truncate font-heading text-sm font-extrabold leading-tight text-foreground">
                {displayName} 👋
              </h1>
            </>
          ) : (
            <p className="text-xs font-bold text-foreground">Ringkasan Keluarga</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {isPrimaryParent ? "Ortu Utama" : "Ortu Pendamping"}
        </span>
      </div>

      <FamilySharedGoalHero sharedFamilyGoal={sharedFamilyGoal} />

      <div className="mt-2 flex gap-1.5">
        <StatChip
          icon={<Users className="size-3 text-violet-600" aria-hidden />}
          value={childrenCount}
          label="Anak"
        />
        <StatChip
          icon={<Target className="size-3 text-rose-500" aria-hidden />}
          value={activeGoalsCount}
          label="Target"
        />
        <StatChip
          icon={<ListTodo className="size-3 text-emerald-600" aria-hidden />}
          value={totalTasksCount}
          label="Misi"
          href="/parent/tasks"
          ariaLabel={`${totalTasksCount} misi semua anak`}
        />
      </div>
    </section>
  );
}
