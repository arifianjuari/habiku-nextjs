import { cn } from "@/lib/utils";

export function ChildFetchingIndicator({
  isFetching,
  className,
}: {
  isFetching: boolean;
  className?: string;
}) {
  if (!isFetching) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed left-1/2 top-2 z-50 -translate-x-1/2 rounded-full bg-emerald-600/90 px-3 py-1 text-[10px] font-bold text-white shadow-md",
        className,
      )}
      aria-live="polite"
    >
      Memperbarui…
    </div>
  );
}
