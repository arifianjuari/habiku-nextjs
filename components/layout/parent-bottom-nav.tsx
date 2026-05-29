"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListTodo, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/parent", label: "Beranda", icon: Home, exact: true },
  { href: "/parent/tasks", label: "Misi", icon: ListTodo },
  { href: "/parent/targets", label: "Target", icon: Target },
  { href: "/parent/profil-anak", label: "Anak", icon: Users },
] as const;

export function ParentBottomNav() {
  const pathname = usePathname();

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
