"use client";

import { motion } from "framer-motion";
import { Gift, Sparkles, Users, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  EMPTY_FAMILY_SHARED_GOAL,
  getSharedFamilyGoalPercent,
  isSharedFamilyGoalActive,
  type FamilySharedGoal,
} from "@/lib/parent/family-shared-goal";
import { cn } from "@/lib/utils";

type ChildFamilySharedGoalCardProps = {
  sharedFamilyGoal?: FamilySharedGoal;
  microAnimEnabled?: boolean;
};

export function ChildFamilySharedGoalCard({
  sharedFamilyGoal = EMPTY_FAMILY_SHARED_GOAL,
  microAnimEnabled = true,
}: ChildFamilySharedGoalCardProps) {
  if (!isSharedFamilyGoalActive(sharedFamilyGoal) || sharedFamilyGoal.targetPoints == null) {
    return null;
  }

  const { title, targetPoints, familyEarnEnergy } = sharedFamilyGoal;
  const percent = getSharedFamilyGoalPercent(familyEarnEnergy, targetPoints);
  const isComplete = familyEarnEnergy >= targetPoints;
  const remaining = Math.max(0, targetPoints - familyEarnEnergy);

  const Wrapper = microAnimEnabled ? motion.div : "div";
  const wrapperProps = microAnimEnabled
    ? {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: 0.06 },
      }
    : {};

  return (
    <Wrapper {...wrapperProps}>
      <Card
        size="sm"
        className={cn(
          "gap-0 overflow-hidden rounded-[1.75rem] py-0 shadow-md",
          isComplete
            ? "border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50"
            : "border-2 border-violet-100 bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/50",
        )}
      >
        <CardContent className="space-y-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md",
                  isComplete
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                    : "bg-gradient-to-br from-violet-500 to-indigo-600",
                )}
              >
                {isComplete ? (
                  <Sparkles className="h-5 w-5" aria-hidden />
                ) : (
                  <Users className="h-5 w-5" aria-hidden />
                )}
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-black text-slate-900">Energi Bersama Keluarga</h3>
                <p className="text-xs font-medium text-slate-500">
                  Kerja sama dengan saudara!
                </p>
              </div>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-black tabular-nums",
                isComplete ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700",
              )}
            >
              {percent}%
            </span>
          </div>

          <div className="space-y-2.5 rounded-xl border border-violet-100/80 bg-white/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-black text-slate-800">
                <Gift className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                <span className="truncate">{title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-sm font-black text-violet-600">
                <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden />
                {familyEarnEnergy}/{targetPoints} E
              </span>
            </div>

            <div
              className="relative h-5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progres energi bersama untuk ${title}`}
            >
              <motion.div
                className={cn(
                  "relative h-full rounded-full",
                  isComplete
                    ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"
                    : "bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500",
                )}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.35)_50%,transparent_100%)] animate-pulse" />
              </motion.div>
              {percent > 8 && (
                <motion.span
                  className="absolute top-1/2 -translate-y-1/2 text-xs"
                  style={{ left: `calc(${percent}% - 12px)` }}
                  animate={microAnimEnabled ? { scale: [1, 1.2, 1] } : undefined}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  aria-hidden
                >
                  {isComplete ? "🎉" : "⭐"}
                </motion.span>
              )}
            </div>

            <p className="text-center text-xs font-bold text-slate-600 text-pretty">
              {isComplete
                ? "Wah! Kalian sudah capai target! Minta Papa/Mama untuk merayakannya! 🎊"
                : `Tinggal ${remaining} E lagi — selesaikan misi dan bantu keluarga! 💪`}
            </p>
          </div>
        </CardContent>
      </Card>
    </Wrapper>
  );
}
