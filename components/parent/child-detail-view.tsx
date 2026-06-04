"use client";

import { motion } from "framer-motion";
import {
  User,
  Zap,
  Target,
  TrendingUp,
  Award,
  Flame,
  Calendar,
  Shield,
  Heart,
  BookOpen,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ChildProfile, Goal, Streak } from "@/types/database";
import { ChildAvatar } from "@/components/shared/child-avatar";
import { PointLedgerList } from "@/components/parent/point-ledger-list";
import { GoalVisualStateBadge } from "@/components/shared/goal-visual-state-badge";
import type { LedgerEntryRow } from "@/lib/parent/ledger-display";
import { getGoalVisualStateMeta } from "@/lib/goals/visual-state";
import { ParentPageHeaderSync } from "@/components/layout/parent-page-header-context";

interface ChildDetailViewProps {
  child: ChildProfile;
  ledgerEntries: LedgerEntryRow[];
  streaks: Streak[];
  goals: Goal[];
  totalPoints: number;
}

const ATTRIBUTE_LABELS = [
  { key: "attr_discipline", label: "Disiplin 🛡️", color: "from-violet-500 to-indigo-500", desc: "Didapat dari pengerjaan misi rutin" },
  { key: "attr_responsibility", label: "Tanggung Jawab 📚", color: "from-blue-500 to-sky-500", desc: "Didapat dari misi belajar" },
  { key: "attr_independence", label: "Kemandirian ✨", color: "from-emerald-500 to-teal-500", desc: "Didapat dari kebersihan diri" },
  { key: "attr_care", label: "Kepedulian 💖", color: "from-amber-500 to-orange-500", desc: "Didapat dari olahraga & tolong menolong" },
  { key: "attr_honesty", label: "Kejujuran 🌟", color: "from-rose-500 to-pink-500", desc: "Didapat dari refleksi & verifikasi jujur" },
] as const;

export function ChildDetailView({
  child,
  ledgerEntries,
  streaks,
  goals,
  totalPoints,
}: ChildDetailViewProps) {
  const childAccent = child.home_card_accent || "#8B5CF6";
  const ledgerPreview = ledgerEntries.slice(0, 8);

  return (
    <div className="space-y-4 pb-8">
      <ParentPageHeaderSync
        title={`Kemajuan RPG ${child.name}`}
        description="Laporan lengkap audit poin, atribut RPG, dan rekam jejak misi anak."
        backHref="/parent"
        backLabel="Kembali ke beranda"
      />

      {/* Profil RPG Card */}
      <Card className="border border-slate-150 shadow-sm bg-white rounded-3xl overflow-hidden">
        {/* Accent Strip */}
        <div className="h-2 w-full" style={{ backgroundColor: childAccent }} />
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChildAvatar
                name={child.name}
                avatarUrl={child.avatar_url}
                avatarPreference={child.avatar_preference}
                avatarEmoji={child.avatar_emoji}
                accentColor={childAccent}
                className="h-14 w-14 shrink-0 rounded-2xl shadow-md shadow-violet-950/10 text-xl font-bold text-white"
                fallbackSizeClass="text-2xl"
              />
              <div>
                <h3 className="font-heading text-lg font-black text-slate-900 leading-none mb-1">{child.name}</h3>
                <span className="text-[10px] bg-slate-50 text-slate-500 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                  Level {Math.floor((child.attr_discipline + child.attr_responsibility + child.attr_independence + child.attr_care + child.attr_honesty) / 5) + 1} Petualang
                </span>
              </div>
            </div>

            {/* Saldo Poin Energi */}
            <div className="flex items-center gap-1 rounded-2xl bg-amber-50 border border-amber-200/50 px-3.5 py-1.5 shadow-sm">
              <Zap className="h-4.5 w-4.5 text-amber-500 fill-amber-500 animate-pulse" />
              <span className="text-sm font-extrabold text-amber-950">{totalPoints} E</span>
            </div>
          </div>

          {/* Atribut RPG Progress */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Statistik Atribut Karakter RPG
            </h4>
            
            <div className="grid gap-3">
              {ATTRIBUTE_LABELS.map((attr) => {
                const val = (child as any)[attr.key] || 0;
                // Calculate max bar: RPG attribute values usually go up to 100 or higher.
                const progressWidth = Math.min(100, Math.max(5, (val / 100) * 100));
                
                return (
                  <div key={attr.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                      <span className="flex items-center gap-1">{attr.label}</span>
                      <span className="font-bold text-slate-900">{val} XP</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out", attr.color)}
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Streaks & Hadiah Lini Masa */}
      <div className="grid grid-cols-2 gap-3">
        {/* Streaks Card */}
        <Card className="border border-slate-150 bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500" />
            Rekor Streak Misi
          </h4>
          
          {streaks.length === 0 ? (
            <div className="text-center py-4 text-[10px] text-muted-foreground">
              Belum ada streak tercatat harian.
            </div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto scrollbar-none">
              {streaks.map((s) => (
                <div key={s.id} className="flex justify-between items-center text-xs">
                  <span className="capitalize font-semibold text-slate-600">{s.task_category}</span>
                  <span className="font-extrabold text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-2 py-0.5 text-[10px] flex items-center gap-0.5">
                    🔥 {s.current_streak} Hari
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Active Target Card */}
        <Card className="border border-slate-150 bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Target className="h-3.5 w-3.5 text-rose-500" />
            Target Utama Aktif
          </h4>

          {goals.filter((g) => g.status === "active").length === 0 ? (
            <div className="text-center py-4 text-[10px] text-muted-foreground leading-relaxed">
              Tidak ada target aktif yang dipilih ortu saat ini.
            </div>
          ) : (
            <div className="space-y-2">
              {goals
                .filter((g) => g.status === "active")
                .slice(0, 1)
                .map((g) => {
                  const progress = Math.min(100, (g.current_hp / g.target_hp) * 100);
                  return (
                    <div key={g.id} className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-800 block text-xs truncate leading-none">
                          {g.title}
                        </span>
                        <GoalVisualStateBadge state={g.visual_state} />
                      </div>
                      {g.visual_state && g.visual_state !== "fresh" ? (
                        <p className="text-[9px] text-muted-foreground leading-snug">
                          {getGoalVisualStateMeta(g.visual_state).shortHint}
                        </p>
                      ) : null}
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-rose-600 font-extrabold block text-right leading-none">
                        {g.current_hp} / {g.target_hp} HP ({Math.round(progress)}%)
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </div>

      {/* 4. Point Ledger (pratinjau) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Buku Besar Poin (Append-Only Audit)
          </h4>
          <Link
            href="/parent/ledger"
            className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
          >
            Lihat semua
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <PointLedgerList entries={ledgerPreview} />
        {ledgerEntries.length > ledgerPreview.length ? (
          <p className="text-center text-[10px] text-muted-foreground">
            +{ledgerEntries.length - ledgerPreview.length} transaksi lainnya di halaman buku besar.
          </p>
        ) : null}
      </div>
    </div>
  );
}