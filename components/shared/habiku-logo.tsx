import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

type HabikuLogoProps = {
  className?: string;
  showWordmark?: boolean;
};

export function HabikuLogo({ className, showWordmark = true }: HabikuLogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
        <Sprout className="size-5" aria-hidden />
      </span>
      {showWordmark ? (
        <span className="font-heading text-xl font-semibold tracking-tight">
          Habiku
        </span>
      ) : null}
    </div>
  );
}
