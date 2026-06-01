import type { Account, Family } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";

type ParentHomeGreetingProps = {
  account: Account;
  family: Family;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

/** Sapaan instan tanpa menunggu query Supabase. */
export function ParentHomeGreeting({ account, family }: ParentHomeGreetingProps) {
  const displayName = account.display_name || "Orang Tua";
  const isPrimary = account.role === "primary_parent";

  return (
    <header className="flex items-start justify-between gap-3 pb-1">
      <div className="space-y-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {getGreeting()}
        </p>
        <h1 className="font-heading text-xl font-black tracking-tight leading-tight text-foreground sm:text-2xl">
          {displayName} 👋
        </h1>
        <p className="text-xs text-muted-foreground text-pretty">
          Pantau energi, misi, dan target keluarga{" "}
          <span className="font-semibold text-foreground">{family.name || "Anda"}</span> hari ini.
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Badge variant="secondary" className="font-bold text-[10px]">
          {isPrimary ? "Ortu Utama" : "Ortu Pendamping"}
        </Badge>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
          <Radio className="h-2.5 w-2.5 animate-pulse" aria-hidden />
          Live sync
        </span>
      </div>
    </header>
  );
}
