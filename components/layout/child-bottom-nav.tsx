"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListTodo, Target, Sprout, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/child/home", label: "Beranda", icon: Home },
  { href: "/child/missions", label: "Misi", icon: ListTodo },
  { href: "/child/savings", label: "Tabung", icon: PiggyBank },
  { href: "/child/targets", label: "Target", icon: Target },
  { href: "/child/garden", label: "Kebun", icon: Sprout },
] as const;

export function ChildBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-200/80 bg-emerald-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="Navigasi anak"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch={true}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs",
                  active ? "font-medium text-emerald-800" : "text-emerald-700/70",
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
