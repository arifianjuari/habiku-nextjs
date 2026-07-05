import { Suspense } from "react";
import { getSessionContext } from "@/lib/auth/get-session-context";
import { ParentBottomNav } from "@/components/layout/parent-bottom-nav";
import { ParentTabPrefetch } from "@/components/parent/parent-tab-prefetch";

async function ParentBottomNavWithFamily() {
  const context = await getSessionContext();
  const familyId = context?.family.id ?? null;

  return (
    <>
      <ParentTabPrefetch familyId={familyId} />
      <ParentBottomNav familyId={familyId} />
    </>
  );
}

function ParentBottomNavFallback() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-hidden
    >
      <div className="mx-auto flex h-[3.25rem] max-w-lg animate-pulse items-center justify-around px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="size-8 rounded-lg bg-muted/80" />
        ))}
      </div>
    </nav>
  );
}

export function ParentBottomNavSlot() {
  return (
    <Suspense fallback={<ParentBottomNavFallback />}>
      <ParentBottomNavWithFamily />
    </Suspense>
  );
}
