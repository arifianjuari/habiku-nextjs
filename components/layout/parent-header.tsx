import Link from "next/link";
import { Settings } from "lucide-react";
import { HabikuLogo } from "@/components/shared/habiku-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ParentSignOutButton } from "@/components/layout/parent-sign-out-button";

export function ParentHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <HabikuLogo showWordmark={false} />
        <div className="flex items-center gap-1">
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
