"use client";

import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { HabikuLogo } from "@/components/shared/habiku-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ParentSignOutButton } from "@/components/layout/parent-sign-out-button";
import { useParentPageHeader } from "@/components/layout/parent-page-header-context";

export function ParentHeaderBar() {
  const { pageHeader } = useParentPageHeader();

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        {pageHeader ? (
          <div className="flex min-w-0 flex-1 items-start gap-2 pr-2">
            {pageHeader.backHref ? (
              <Link
                href={pageHeader.backHref}
                aria-label={pageHeader.backLabel ?? "Kembali"}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "mt-0.5 shrink-0"
                )}
              >
                <ArrowLeft className="size-4" />
              </Link>
            ) : null}
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-heading text-base font-bold leading-tight text-foreground">
                {pageHeader.title}
              </h1>
              {pageHeader.description ? (
                <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                  {pageHeader.description}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <HabikuLogo showWordmark={false} />
        )}

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/parent/settings"
            aria-label="Pengaturan"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <Settings className="size-5" />
          </Link>
          <ParentSignOutButton />
        </div>
      </div>
    </header>
  );
}
