"use client";

import { motion } from "framer-motion";
import {
  User,
  Zap,
  Target,
  TrendingUp,
  Award,
  ChevronLeft,
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

interface LedgerWithRelations {
  id: string;
  profile_id: string;
  amount: number;
  type: string;
  created_at: string;
  task_history?: {
    notes: string | null;
    task?: {
      title: string;
      category: string;
    };
  } | null;
}

interface ChildDetailViewProps {
  child: ChildProfile;
  ledgerEntries: LedgerWithRelations[];
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

  const getLedgerDetail = (entry: LedgerWithRelations) => {
    if (entry.type === "earn") {
      const taskTitle = entry.task_history?.task?.title || "Misi Selesai";
      return {
        title: taskTitle,
        desc: "Misi disetujui orang tua",
        amountSign: "+",
        color: "text-emerald-600 bg-emerald-50 border-emerald-100",
        pointsColor: "text-emerald-700",
      };
    } else if (entry.type === "spend") {
      return {
        title: "Penebusan Hadiah",
        desc: "Poin energi dibelanjakan untuk target",
        amountSign: "-",
        color: "text-rose-600 bg-rose-50 border-rose-100",
        pointsColor: "text-rose-700",
      };
    } else if (entry.type === "bonus_checkin" as any) {
      return {
        title: "Bonus Check-in Harian",
        desc: "Kehadiran harian anak",
        amountSign: "+",
        color: "text-amber-600 bg-amber-50 border-amber-100",
        pointsColor: "text-amber-700",
      };
    } else {
      return {
        title: "Penyesuaian Manual Ortu",
        desc: "Penyesuaian saldo poin",
        amountSign: entry.amount >= 0 ? "+" : "-",
        color: "text-slate-600 bg-slate-50 border-slate-200",
        pointsColor: entry.amount >= 0 ? "text-slate-700" : "text-rose-700",
      };
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB";
    } catch {
      return "Tanggal tidak valid";
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Header Back Navigation */}
      <div className="flex items-center gap-3">
        <Link
          href="/parent"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 bg-white text-slate-600 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-none mb-1">
            Kemajuan RPG {child.name}
          </h2>
          <p className="text-[10px] text-muted-foreground">
            Laporan lengkap audit poin, atribut RPG, dan rekam jejak misi anak.
          </p>
        </div>
      </div>

      {/* 2. Profil RPG Card */}
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
                      <span className="font-bold text-slate-800 block text-xs truncate leading-none">
                        {g.title}
                      </span>
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

      {/* 4. Point Ledger (Buku Besar Poin) */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
          Buku Besar Poin (Append-Only Audit)
        </h4>

        {ledgerEntries.length === 0 ? (
          <div className="text-center py-10 rounded-3xl border-2 border-dashed border-slate-200 bg-white/40 backdrop-blur-sm text-slate-400 text-xs">
            Belum ada transaksi poin ledger yang tercatat.
          </div>
        ) : (
          <div className="grid gap-2">
            {ledgerEntries.map((entry) => {
              const detail = getLedgerDetail(entry);
              return (
                <Card key={entry.id} className="border border-slate-150 bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm font-black", detail.color)}>
                        {detail.amountSign}
                      </div>
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-xs text-slate-900 leading-snug">
                          {detail.title}
                        </h5>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-muted-foreground font-semibold">
                          <span>{detail.desc}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            {formatDate(entry.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Jumlah Energi Mutasi */}
                    <div className={cn("text-xs font-black shrink-0", detail.pointsColor)}>
                      {detail.amountSign}
                      {Math.abs(entry.amount)} E
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
