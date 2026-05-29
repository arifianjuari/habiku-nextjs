"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Zap, Target, ClipboardList, Sparkles, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Account, Family } from "@/types/database";

type ParentHomeHeroProps = {
  account: Account;
  family: Family;
  familyEnergy: number;
  childrenCount: number;
  activeGoalsCount: number;
  pendingCount: number;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

export function ParentHomeHero({
  account,
  family,
  familyEnergy,
  childrenCount,
  activeGoalsCount,
  pendingCount,
}: ParentHomeHeroProps) {
  const displayName = account.display_name || "Orang Tua";
  const isPrimary = account.role === "primary_parent";

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-700 via-emerald-800 to-teal-900 p-5 text-white shadow-lg shadow-emerald-900/20"
      aria-labelledby="parent-home-greeting"
    >
      <div className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-teal-300/15 blur-xl" />
      <Sparkles
        className="pointer-events-none absolute right-4 top-3 h-16 w-16 text-white/20"
        aria-hidden
      />

      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100/80">
              {getGreeting()}
            </p>
            <h1
              id="parent-home-greeting"
              className="font-heading text-xl font-black tracking-tight leading-tight sm:text-2xl"
            >
              {displayName} 👋
            </h1>
            <p className="text-xs text-emerald-100/90 text-pretty">
              Pantau energi, misi, dan target keluarga{" "}
              <span className="font-semibold text-white">{family.name || "Anda"}</span> hari ini.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge className="border-emerald-500/30 bg-emerald-950/40 text-emerald-50 font-bold text-[10px]">
              {isPrimary ? "Ortu Utama" : "Ortu Pendamping"}
            </Badge>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/30 px-2 py-0.5 text-[9px] font-semibold text-emerald-100/90">
              <Radio className="h-2.5 w-2.5 animate-pulse" aria-hidden />
              Live sync
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/30 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-100/90">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Total Energi Keluarga
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-heading text-4xl font-black tracking-tight sm:text-5xl">
              {familyEnergy}
            </span>
            <span className="text-sm font-semibold text-emerald-200">Energi (E)</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-emerald-100/75">
            Akumulasi dari semua anak — dialokasikan untuk menebus target hadiah aktif.
          </p>
        </div>

        <ul className="grid grid-cols-3 gap-2" aria-label="Ringkasan keluarga">
          <li className="rounded-xl border border-white/10 bg-white/10 px-2 py-2.5 text-center backdrop-blur-sm">
            <p className="flex items-center justify-center gap-1 text-lg font-black leading-none">
              <Users className="h-3.5 w-3.5 text-emerald-200" aria-hidden />
              {childrenCount}
            </p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-100/80">
              Anak
            </p>
          </li>
          <li className="rounded-xl border border-white/10 bg-white/10 px-2 py-2.5 text-center backdrop-blur-sm">
            <p className="flex items-center justify-center gap-1 text-lg font-black leading-none">
              <Target className="h-3.5 w-3.5 text-rose-200" aria-hidden />
              {activeGoalsCount}
            </p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-100/80">
              Target Aktif
            </p>
          </li>
          <li>
            <Link
              href="/parent/queue"
              aria-label={`${pendingCount} misi menunggu persetujuan`}
              className={`block rounded-xl border px-2 py-2.5 text-center backdrop-blur-sm transition-colors ${
                pendingCount > 0
                  ? "border-amber-300/50 bg-amber-400/25 hover:bg-amber-400/35"
                  : "border-white/10 bg-white/10 hover:bg-white/15"
              }`}
            >
              <span className="flex items-center justify-center gap-1 text-lg font-black leading-none">
                <ClipboardList
                  className={`h-3.5 w-3.5 ${pendingCount > 0 ? "text-amber-100" : "text-emerald-200"}`}
                  aria-hidden
                />
                {pendingCount}
              </span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-wide text-emerald-100/80">
                Menunggu
              </span>
            </Link>
          </li>
        </ul>

        <div className="flex items-center gap-2 rounded-xl bg-emerald-950/25 px-3 py-2 text-[10px] font-semibold text-emerald-50/90">
          <Zap className="h-3.5 w-3.5 shrink-0 text-amber-300 fill-amber-300" aria-hidden />
          Semua transaksi energi tercatat di Point Ledger — aman & dapat diaudit.
        </div>
      </div>
    </motion.section>
  );
}
