import { Droplets, Leaf, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGoalVisualStateMeta } from "@/lib/goals/visual-state";
import type { GoalVisualState } from "@/lib/database/enums";

type GoalVisualStateBadgeProps = {
  state: GoalVisualState | string | null | undefined;
  className?: string;
  showHint?: boolean;
};

function StateIcon({ state }: { state: string }) {
  if (state === "fresh") {
    return <Sun className="h-3 w-3 shrink-0" aria-hidden />;
  }
  if (state === "slightly_wilted" || state === "wilted") {
    return <Droplets className="h-3 w-3 shrink-0" aria-hidden />;
  }
  return <Leaf className="h-3 w-3 shrink-0" aria-hidden />;
}

export function GoalVisualStateBadge({
  state,
  className,
  showHint = false,
}: GoalVisualStateBadgeProps) {
  const resolved =
    state && state !== "fresh" ? (state as GoalVisualState) : null;

  if (!resolved && !showHint) {
    return null;
  }

  const meta = getGoalVisualStateMeta(state);

  return (
    <div className={cn("space-y-1", className)}>
      {resolved ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold",
            meta.badgeClass,
          )}
        >
          <StateIcon state={resolved} />
          {meta.label}
        </span>
      ) : null}
      {showHint && resolved ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground">{meta.shortHint}</p>
      ) : null}
    </div>
  );
}
