"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Home, ListTodo, Target, Users, PiggyBank } from "lucide-react";
import { prefetchParentTabData } from "@/lib/parent/prefetch-parent-queries";
import { cn } from "@/lib/utils";

const items = [
  { href: "/parent", label: "Beranda", icon: Home, exact: true },
  { href: "/parent/tasks", label: "Misi", icon: ListTodo },
  { href: "/parent/savings", label: "Tabungan", icon: PiggyBank },
  { href: "/parent/targets", label: "Target", icon: Target },
  { href: "/parent/profil-anak", label: "Anak", icon: Users },
] as const;

type ParentBottomNavProps = {
  familyId: string | null;
};

export function ParentBottomNav({ familyId }: ParentBottomNavProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const warmTab = (href: string) => {
    if (!familyId) return;
    void prefetchParentTabData(queryClient, familyId, href);
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label="Navigasi orang tua"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map(({ href, label, icon: Icon, ...rest }) => {
          const exact = "exact" in rest && rest.exact;
          const active = exact ? pathname === href : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch={true}
                onMouseEnter={() => warmTab(href)}
                onFocus={() => warmTab(href)}
                onTouchStart={() => warmTab(href)}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs transition-colors",
                  active
                    ? "font-medium text-emerald-700"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
