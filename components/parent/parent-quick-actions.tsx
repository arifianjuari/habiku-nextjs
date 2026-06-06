import Link from "next/link";
import { ClipboardCheck, Gift, ReceiptText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type QuickAction = {
  href: string;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  badge?: number;
};

type ParentQuickActionsProps = {
  pendingCount: number;
};

export function ParentQuickActions({ pendingCount }: ParentQuickActionsProps) {
  const actions: QuickAction[] = [
    {
      href: "/parent/queue",
      label: "Tinjau Misi",
      icon: ClipboardCheck,
      iconClassName: "bg-amber-100 text-amber-700",
      badge: pendingCount,
    },
    {
      href: "/parent/incidental",
      label: "Beri Bonus",
      icon: Gift,
      iconClassName: "bg-rose-100 text-rose-700",
    },
    {
      href: "/parent/ledger",
      label: "Riwayat",
      icon: ReceiptText,
      iconClassName: "bg-sky-100 text-sky-700",
    },
  ];

  return (
    <nav aria-label="Aksi cepat" className="grid grid-cols-3 gap-2.5">
      {actions.map(({ href, label, icon: Icon, iconClassName, badge }) => (
        <Link
          key={href}
          href={href}
          className="group flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-2 py-3.5 text-center shadow-sm ring-1 ring-foreground/5 transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
        >
          <span className="relative">
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-2xl transition-transform group-hover:scale-105",
                iconClassName,
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            {badge && badge > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white ring-2 ring-background">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </span>
          <span className="text-[11px] font-bold text-foreground">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
