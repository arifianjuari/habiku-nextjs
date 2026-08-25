import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ChildModeGuard } from "@/components/child/child-mode-guard";
import { ChildTabPrefetch } from "@/components/child/child-tab-prefetch";
import { ChildBottomNav } from "@/components/layout/child-bottom-nav";
import { ChildHeader } from "@/components/layout/child-header";
import {
  CHILD_MODE_COOKIE,
  isChildModeCookieValue,
} from "@/lib/child/child-mode-session";
import { getServerChildProfileId } from "@/lib/child/get-server-child-profile-id";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  const [profileId, cookieStore] = await Promise.all([getServerChildProfileId(), cookies()]);
  const childModeActive = isChildModeCookieValue(cookieStore.get(CHILD_MODE_COOKIE)?.value);
  const serverSessionReady = childModeActive && profileId !== null;

  return (
    <ChildModeGuard serverSessionReady={serverSessionReady} serverProfileId={profileId}>
      <ChildTabPrefetch />
      <div className="relative flex min-h-full flex-col overflow-x-hidden bg-gradient-to-b from-sky-50 via-emerald-50/70 to-amber-50/40 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -left-20 top-24 h-56 w-56 rounded-full bg-violet-200/25 blur-3xl" />
          <div className="absolute -right-16 top-64 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl" />
          <div className="absolute bottom-32 left-1/3 h-40 w-40 rounded-full bg-sky-200/25 blur-3xl" />
        </div>
        <ChildHeader />
        <div className="relative z-10 mx-auto w-full max-w-lg flex-1 px-4 py-4">{children}</div>
        <ChildBottomNav />
      </div>
    </ChildModeGuard>
  );
}
