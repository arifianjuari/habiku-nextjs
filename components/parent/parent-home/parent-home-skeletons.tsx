import { cn } from "@/lib/utils";

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-muted", className)} />;
}

export function ParentHomeMainSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat ringkasan dan profil anak">
      <Pulse className="h-52 w-full rounded-3xl bg-emerald-100/80" />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Pulse className="h-5 w-32" />
          <Pulse className="h-4 w-20" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          <Pulse className="h-36 min-w-[85%] shrink-0 rounded-3xl" />
          <Pulse className="h-36 min-w-[85%] shrink-0 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

export function ParentHomeActivitySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuat aktivitas terbaru">
      <Pulse className="h-5 w-40" />
      <Pulse className="h-24 w-full rounded-3xl" />
      <Pulse className="h-24 w-full rounded-3xl" />
      <Pulse className="h-24 w-full rounded-3xl" />
    </div>
  );
}
