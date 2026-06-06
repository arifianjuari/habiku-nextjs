import { cn } from "@/lib/utils";

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-muted", className)} />;
}

export function ParentHomeMainSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat ringkasan dan profil anak">
      <div className="space-y-3">
        <Pulse className="h-[168px] w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-2.5">
          <Pulse className="h-20 rounded-2xl" />
          <Pulse className="h-20 rounded-2xl" />
          <Pulse className="h-20 rounded-2xl" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Pulse className="h-5 w-32" />
          <Pulse className="h-4 w-20" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          <Pulse className="h-[188px] min-w-[80%] shrink-0 rounded-2xl" />
          <Pulse className="h-[188px] min-w-[80%] shrink-0 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function ParentHomeActivitySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuat aktivitas terbaru">
      <Pulse className="h-5 w-40" />
      <Pulse className="h-[68px] w-full rounded-2xl" />
      <Pulse className="h-[68px] w-full rounded-2xl" />
      <Pulse className="h-[68px] w-full rounded-2xl" />
    </div>
  );
}
