"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Home, ListTodo, Target, Sprout, PiggyBank } from "lucide-react";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { prefetchChildTabData } from "@/lib/child/prefetch-child-queries";
import { isValidChildProfileId } from "@/lib/child/profile-id";
import { cn } from "@/lib/utils";

const items = [
  {
    href: "/child/home",
    label: "Beranda",
    icon: Home,
    gradient: "from-emerald-500 to-teal-600",
    activeLabel: "text-emerald-700",
  },
  {
    href: "/child/missions",
    label: "Misi",
    icon: ListTodo,
    gradient: "from-violet-500 to-indigo-600",
    activeLabel: "text-violet-700",
  },
  {
    href: "/child/savings",
    label: "Tabung",
    icon: PiggyBank,
    gradient: "from-amber-400 to-orange-500",
    activeLabel: "text-amber-700",
  },
  {
    href: "/child/targets",
    label: "Target",
    icon: Target,
    gradient: "from-rose-500 to-pink-600",
    activeLabel: "text-rose-700",
  },
  {
    href: "/child/garden",
    label: "Kebun",
    icon: Sprout,
    gradient: "from-lime-500 to-emerald-600",
    activeLabel: "text-lime-700",
  },
] as const;

export function ChildBottomNav() {
  const pathname = usePathname();
  const profileId = useChildModeStore((s) => s.profileId);
  const queryClient = useQueryClient();

  const warmTab = (href: string) => {
    if (!isValidChildProfileId(profileId)) return;
    void prefetchChildTabData(queryClient, profileId, href);
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/60 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_28px_rgba(15,23,42,0.08)] backdrop-blur-md"
      aria-label="Navigasi anak"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {items.map(({ href, label, icon: Icon, gradient, activeLabel }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch={true}
                onTouchStart={() => warmTab(href)}
                className={cn(
                  "group flex min-h-[4rem] flex-col items-center justify-center gap-1 px-0.5 py-1.5 transition-transform active:scale-95",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-all",
                    gradient,
                    active
                      ? "scale-110 shadow-lg ring-2 ring-white"
                      : "opacity-80 group-hover:scale-105 group-hover:opacity-100",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-none transition-colors",
                    active ? cn("font-black", activeLabel) : "font-semibold text-slate-400",
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
