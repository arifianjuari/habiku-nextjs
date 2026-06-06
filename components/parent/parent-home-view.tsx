"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusCircle, UserPlus } from "lucide-react";
import { ChildrenCarousel } from "@/components/parent/children-carousel";
import { ParentHomeHero } from "@/components/parent/parent-home-hero";
import { ParentActivityFeed } from "@/components/parent/parent-activity-feed";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { useFamilyRealtime } from "@/lib/hooks/use-family-realtime";
import type { ParentDashboardData } from "@/lib/parent/fetch-parent-dashboard";
import { cn } from "@/lib/utils";

type ParentHomeViewProps = ParentDashboardData;

export function ParentHomeView({
  account,
  family,
  childrenWithData,
  totalTasksCount,
  recentActivities,
  activeGoalsCount,
  sharedFamilyGoal,
}: ParentHomeViewProps) {
  const router = useRouter();
  const childProfileIds = childrenWithData.map((item) => item.child.id);

  const handleFamilyDataChange = useCallback(() => {
    router.refresh();
  }, [router]);

  useFamilyRealtime({
    childProfileIds,
    accountId: account.id,
    onFamilyDataChange: handleFamilyDataChange,
  });

  return (
    <div className="space-y-6 pb-2">
      <ParentHomeHero
        childrenCount={childrenWithData.length}
        activeGoalsCount={activeGoalsCount}
        totalTasksCount={totalTasksCount}
        isPrimaryParent={account.role === "primary_parent"}
        sharedFamilyGoal={sharedFamilyGoal}
      />

      <section aria-labelledby="parent-children-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="parent-children-heading"
            className="flex items-center gap-2 font-heading text-base font-extrabold text-foreground"
          >
            Buah Hati Anda
            {childrenWithData.length > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary">
                {childrenWithData.length}
              </span>
            )}
          </h2>
          <Link
            href="/parent/profil-anak"
            className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-primary hover:text-primary/80"
          >
            <PlusCircle className="h-4 w-4" aria-hidden />
            Tambah profil
          </Link>
        </div>

        {childrenWithData.length > 0 ? (
          <ChildrenCarousel items={childrenWithData} />
        ) : (
          <Card className="rounded-3xl border border-dashed border-border bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <UserPlus className="h-7 w-7" aria-hidden />
              </div>
              <div className="space-y-1 max-w-xs">
                <h3 className="text-sm font-bold text-foreground">Belum ada profil anak</h3>
                <p className="text-xs text-muted-foreground text-pretty">
                  Tambahkan profil pertama untuk mulai menugaskan misi harian dan target
                  hadiah — sesuai alur onboarding di PRD.
                </p>
              </div>
              <Link
                href="/parent/profil-anak"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "rounded-xl font-bold",
                )}
              >
                Buat profil anak
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      <ParentActivityFeed activities={recentActivities} />
    </div>
  );
}
