import { cn } from "@/lib/utils";

type PageLoadingSkeletonProps = {
  variant?: "parent" | "child";
  className?: string;
};

export function PageLoadingSkeleton({
  variant = "parent",
  className,
}: PageLoadingSkeletonProps) {
  const isChild = variant === "child";

  return (
    <div className={cn("animate-pulse space-y-4", className)} aria-busy="true" aria-label="Memuat halaman">
      <div
        className={cn(
          "h-28 rounded-3xl",
          isChild ? "bg-emerald-100/80" : "bg-muted",
        )}
      />
      <div className="grid gap-3">
        <div className={cn("h-24 rounded-3xl", isChild ? "bg-white/80" : "bg-muted/80")} />
        <div className={cn("h-24 rounded-3xl", isChild ? "bg-white/80" : "bg-muted/80")} />
        <div className={cn("h-20 rounded-3xl", isChild ? "bg-white/60" : "bg-muted/60")} />
      </div>
    </div>
  );
}
