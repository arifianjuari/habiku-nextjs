"use client";

import { useState, useEffect, useTransition } from "react";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Target,
  Flame,
  Award,
  Sparkles,
  Shield,
  Calendar,
  CheckCircle,
  HelpCircle,
  Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { checkInChildAction } from "@/app/child/actions";
import type { ChildProfile, Goal, Streak } from "@/types/database";
import { ChildAvatar } from "@/components/shared/child-avatar";

interface CheckInResponse {
  already: boolean;
  bonus: number;
  chain_length: number;
  check_in_date: string;
}

export function ChildHomeView() {
  const { profileId, profileName } = useChildModeStore();
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [checkInChain, setCheckInChain] = useState(0);
  const [isCheckedInToday, setIsCheckedInToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const supabase = createClient();

  useEffect(() => {
    if (!profileId) return;
    const activeProfileId = profileId;

    // Guard: Pastikan profileId adalah UUID yang valid untuk mencegah Postgres 22P02 error
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(activeProfileId)) {
      console.warn("⚠️ Invalid profileId UUID format in Home:", activeProfileId);
      setLoading(false);
      return;
    }

    async function loadChildData() {
      try {
        setLoading(true);

        // 1. Fetch child profile
        const { data: profile } = await supabase
          .from("child_profiles")
          .select("*")
          .eq("id", activeProfileId)
          .maybeSingle();
        
        if (profile) setChild(profile);

        // 2. Fetch point ledger sum
        const { data: ledger } = await supabase
          .from("point_ledger")
          .select("amount")
          .eq("profile_id", activeProfileId);
        
        const sum = ledger?.reduce((sum, entry) => sum + entry.amount, 0) || 0;
        setTotalPoints(sum);

        // 3. Fetch active goal
        const { data: goal } = await supabase
          .from("goals")
          .select("*")
          .eq("profile_id", activeProfileId)
          .eq("status", "active")
          .maybeSingle();
        
        if (goal) setActiveGoal(goal);

        // 4. Fetch daily check-in chain length
        const { data: chainData, error: chainError } = await (supabase as any).rpc(
          "compute_check_in_chain_length",
          { p_profile_id: activeProfileId }
        );
        if (!chainError && typeof chainData === "number") {
          setCheckInChain(chainData);
        }

        // 5. Check if checked in today
        const todayStr = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }))
          .toISOString()
          .split("T")[0];
        
        const { data: checkInToday } = await supabase
          .from("daily_check_ins")
          .select("id")
          .eq("profile_id", activeProfileId)
          .eq("check_in_date", todayStr)
          .maybeSingle();

        setIsCheckedInToday(!!checkInToday);
      } catch (err) {
        console.error("Error loading child dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadChildData();
  }, [profileId, isCheckedInToday]);

  const handleCheckIn = () => {
    if (!profileId) return;

    startTransition(async () => {
      const res = await checkInChildAction(profileId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        setIsCheckedInToday(true);
        if (res.already) {
          toast.info("Kamu sudah melakukan check-in hari ini!");
        } else {
          toast.success(`Check-in berhasil! Kamu mendapatkan +${res.bonus} Energi! 🎯`);
          setTotalPoints((prev) => prev + (res.bonus || 2));
        }
        if (typeof res.chain_length === "number") {
          setCheckInChain(res.chain_length);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <span className="text-xs font-semibold text-emerald-800">Menyiapkan Beranda RPG Kamu…</span>
      </div>
    );
  }

  const childAccent = child?.home_card_accent || "#10B981"; // Default emerald

  return (
    <div className="space-y-6">
      {/* 1. Welcoming RPG Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-5 text-white bg-gradient-to-r from-emerald-600 to-teal-500 shadow-lg shadow-emerald-700/10"
      >
        {/* Sparkles background effect */}
        <div className="absolute top-2 right-4 opacity-30">
          <Sparkles className="h-20 w-20 text-white fill-white animate-pulse" />
        </div>

        <div className="flex items-center gap-4">
          <ChildAvatar
            name={profileName || "Anak"}
            avatarUrl={child?.avatar_url || null}
            avatarPreference={child?.avatar_preference}
            avatarEmoji={child?.avatar_emoji}
            accentColor={childAccent}
            className="h-14 w-14 shrink-0 rounded-2xl shadow-inner text-xl font-bold text-white"
            fallbackSizeClass="text-2xl"
          />

          <div className="space-y-1">
            <h2 className="font-heading text-lg font-black tracking-tight leading-none">
              Hai, {profileName}! 👋
            </h2>
            <p className="text-[10px] text-emerald-50 leading-relaxed font-semibold">
              Kumpulkan poin energi untuk menukar target hadiah impianmu!
            </p>
          </div>
        </div>

        {/* Energy bar summary */}
        <div className="mt-4 flex items-center justify-between bg-emerald-950/20 rounded-2xl p-2 px-3 border border-emerald-500/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
            Energi Terkumpul:
          </span>
          <span className="text-sm font-extrabold text-white">{totalPoints} E</span>
        </div>
      </motion.div>

      {/* 2. Daily Check-in RPG Card */}
      <Card className="border border-emerald-100 bg-white/70 backdrop-blur-md rounded-3xl shadow-sm overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Calendar className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-800 leading-none">Kehadiran Harian</h4>
                <p className="text-[9px] text-slate-500">Log in harian untuk bonus energi</p>
              </div>
            </div>

            {/* Streak Counter */}
            {checkInChain > 0 && (
              <div className="flex items-center gap-1 bg-orange-50 border border-orange-100 rounded-full px-3 py-1">
                <Flame className="h-4 w-4 text-orange-500 fill-orange-500 animate-bounce" />
                <span className="text-[10px] font-black text-orange-700">🔥 {checkInChain} Hari!</span>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!isCheckedInToday ? (
              <motion.div
                key="checkin-btn"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Button
                  onClick={handleCheckIn}
                  disabled={isPending}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-12 rounded-2xl shadow-md shadow-emerald-700/10 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-4.5 w-4.5 text-amber-300 fill-amber-300" />
                  {isPending ? "Sedang Check-in..." : "Klaim Check-in Hari Ini 🎯"}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="checkin-done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-3.5 flex gap-2.5 items-center justify-center text-xs text-emerald-800 font-bold"
              >
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>Kamu sudah check-in hari ini! (+2 E) 🎉</span>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* 3. RPG Active Goal Progress */}
      {activeGoal ? (
        <Card className="border border-rose-100 bg-white/70 backdrop-blur-md rounded-3xl shadow-sm overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className="flex gap-2.5 items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                <Target className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-800 leading-none">Misi Penukaran Hadiah</h4>
                <p className="text-[9px] text-slate-500">Tukarkan energimu saat HP target penuh!</p>
              </div>
            </div>

            <div className="rounded-2xl bg-rose-50/20 border border-rose-100/50 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  🎁 Target: {activeGoal.title}
                </span>
                <span className="font-black text-rose-700">
                  {activeGoal.current_hp} / {activeGoal.target_hp} HP
                </span>
              </div>

              {/* Progress Bar */}
              <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(100, (activeGoal.current_hp / activeGoal.target_hp) * 100)}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                <span>{Math.round(Math.min(100, (activeGoal.current_hp / activeGoal.target_hp) * 100))}% Selesai</span>
                <span>
                  {activeGoal.current_hp >= activeGoal.target_hp
                    ? "Hadiah siap diklaim ke Papa/Mama! 🎉"
                    : `${activeGoal.target_hp - activeGoal.current_hp} HP energi lagi`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center p-6 text-center rounded-3xl border border-dashed border-slate-200 bg-white/40 backdrop-blur-sm space-y-2">
          <Trophy className="h-8 w-8 text-slate-400" />
          <h3 className="text-xs font-bold text-slate-700">Belum Ada Target Aktif</h3>
          <p className="text-[10px] text-slate-400 max-w-[200px]">
            Minta Papa atau Mama untuk mengaktifkan target hadiah pertamamu di dasbor orang tua!
          </p>
        </div>
      )}
    </div>
  );
}
