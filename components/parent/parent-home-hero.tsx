"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Zap, Target, ClipboardList, Info, Radio } from "lucide-react";

type ParentHomeHeroProps = {
  familyEnergy: number;
  childrenCount: number;
  activeGoalsCount: number;
  pendingCount: number;
  isPrimaryParent: boolean;
};

const FAMILY_ENERGY_INFO =
  "Akumulasi dari semua anak — dialokasikan untuk menebus target hadiah aktif. Semua transaksi energi tercatat di Point Ledger.";

function FamilyEnergyInfoButton() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Info total energi keluarga"
        className="inline-flex size-4 items-center justify-center rounded-full text-emerald-100/60 transition-colors hover:bg-emerald-500/20 hover:text-emerald-50"
      >
        <Info className="size-3" aria-hidden />
      </button>
      {open ? (
        <p
          role="tooltip"
          className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg border border-emerald-500/30 bg-emerald-950/95 px-2.5 py-2 text-[10px] leading-snug text-emerald-100/90 shadow-lg backdrop-blur-sm"
        >
          {FAMILY_ENERGY_INFO}
        </p>
      ) : null}
    </div>
  );
}

type StatItemProps = {
  icon: ReactNode;
  value: number;
  label: string;
};

function StatItem({ icon, value, label }: StatItemProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1">
      <span className="flex items-center gap-1 text-base font-black leading-none tabular-nums">
        {icon}
        {value}
      </span>
      <span className="truncate text-[8px] font-semibold uppercase tracking-wide text-emerald-100/75">
        {label}
      </span>
    </div>
  );
}

export function ParentHomeHero({
  familyEnergy,
  childrenCount,
  activeGoalsCount,
  pendingCount,
  isPrimaryParent,
}: ParentHomeHeroProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-700 via-emerald-800 to-teal-900 p-3.5 text-white shadow-md shadow-emerald-900/15"
      aria-label="Ringkasan energi dan statistik keluarga"
    >
      <div className="pointer-events-none absolute -right-4 -top-6 size-20 rounded-full bg-emerald-400/15 blur-2xl" />

      <div className="relative flex flex-col gap-2">
        <div className="flex items-center justify-end gap-1.5">
          <span className="inline-flex h-5 items-center rounded-full border border-white/15 bg-white/10 px-2 text-[9px] font-bold text-emerald-50">
            {isPrimaryParent ? "Ortu Utama" : "Ortu Pendamping"}
          </span>
          <span className="inline-flex h-5 items-center gap-1 rounded-full border border-white/10 bg-emerald-950/30 px-2 text-[9px] font-semibold text-emerald-100/80">
            <Radio className="size-2.5 animate-pulse" aria-hidden />
            Live sync
          </span>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-100/80">
              <Zap className="size-3 shrink-0 fill-amber-300 text-amber-300" aria-hidden />
              <span className="truncate">Total Energi Keluarga</span>
              <FamilyEnergyInfoButton />
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-heading text-3xl font-black leading-none tracking-tight tabular-nums">
                {familyEnergy}
              </span>
              <span className="text-xs font-semibold text-emerald-200/90">E</span>
            </div>
          </div>

          <ul
            className="flex shrink-0 divide-x divide-white/15 rounded-xl border border-white/10 bg-white/5"
            aria-label="Ringkasan keluarga"
          >
            <li>
              <StatItem
                icon={<Users className="size-3 text-emerald-200" aria-hidden />}
                value={childrenCount}
                label="Anak"
              />
            </li>
            <li>
              <StatItem
                icon={<Target className="size-3 text-rose-200" aria-hidden />}
                value={activeGoalsCount}
                label="Target"
              />
            </li>
            <li>
              <Link
                href="/parent/queue"
                aria-label={`${pendingCount} misi menunggu persetujuan`}
                className={`block rounded-r-xl transition-colors ${
                  pendingCount > 0
                    ? "bg-amber-400/20 hover:bg-amber-400/30"
                    : "hover:bg-white/5"
                }`}
              >
                <StatItem
                  icon={
                    <ClipboardList
                      className={`size-3 ${pendingCount > 0 ? "text-amber-100" : "text-emerald-200"}`}
                      aria-hidden
                    />
                  }
                  value={pendingCount}
                  label="Tunggu"
                />
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </motion.section>
  );
}
