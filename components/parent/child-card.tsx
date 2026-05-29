"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Target, Play, ArrowRight, Calendar, User, Sparkles } from "lucide-react";
import type { ChildProfile, Goal } from "@/types/database";
import { ChildAvatar } from "@/components/shared/child-avatar";

interface ChildCardProps {
  child: ChildProfile;
  activeGoal: Goal | null;
  points: number;
}

export function ChildCard({ child, activeGoal, points }: ChildCardProps) {
  const router = useRouter();
  const enter = useChildModeStore((s) => s.enter);

  // Calculate age dynamically
  const getAge = (dobString: string | null) => {
    if (!dobString) return null;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = getAge(child.date_of_birth);

  const handleEnterChildModeDirect = () => {
    // Success! Set child mode store and redirect
    enter(child.id, child.name);
    
    // Simpan cookie pendukung untuk middleware auth ringan
    document.cookie = `habiku_child_mode=1; path=/; max-age=${60 * 60 * 24 * 7}`; // 1 week
    
    router.push("/child/home");
  };

  const accentColor = child.home_card_accent || "#8B5CF6"; // Default violet

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      <Card
        className="overflow-hidden border bg-white/70 backdrop-blur-md transition-all shadow-md hover:shadow-xl"
        style={{ borderColor: `${accentColor}30` }}
      >
        {/* Accent Top Strip */}
        <div className="h-2 w-full" style={{ backgroundColor: accentColor }} />

        <CardContent className="p-5 space-y-5">
          {/* Header Info */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <ChildAvatar
                name={child.name}
                avatarUrl={child.avatar_url}
                avatarPreference={child.avatar_preference}
                avatarEmoji={child.avatar_emoji}
                accentColor={accentColor}
                className="h-12 w-12 shrink-0 rounded-2xl shadow-md shadow-emerald-950/5"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-heading text-base font-bold text-slate-900 leading-snug truncate" title={child.name}>
                  {child.name}
                </h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {age !== null ? `${age} Tahun` : "Belum diatur"} • {child.gender === "female" ? "Perempuan" : child.gender === "male" ? "Laki-laki" : "Lainnya"}
                  </span>
                </p>
              </div>
            </div>

            {/* Current Poin/Energi */}
            <div className="flex items-center gap-1 rounded-2xl bg-amber-50 border border-amber-200/50 px-3 py-1.5 shadow-sm shrink-0">
              <Zap className="h-4 w-4 text-amber-500 fill-amber-500 animate-pulse shrink-0" />
              <span className="text-sm font-extrabold text-amber-950 whitespace-nowrap">{points} E</span>
            </div>
          </div>

          {/* Active Goal Progress */}
          {activeGoal ? (
            <div className="space-y-2 rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-rose-500" />
                  Target: {activeGoal.title}
                </span>
                <span className="font-extrabold text-slate-900">
                  {activeGoal.current_hp} / {activeGoal.target_hp} HP
                </span>
              </div>
              {/* Progress Bar */}
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-rose-500 to-pink-500"
                  style={{ width: `${Math.min(100, (activeGoal.current_hp / activeGoal.target_hp) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right italic">
                {activeGoal.current_hp >= activeGoal.target_hp ? "Siap diklaim! 🎉" : "Kumpulkan energi untuk menebus hadiah"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 px-3 rounded-2xl border border-dashed border-slate-200 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-500">Tidak ada target aktif</p>
              <p className="text-[10px] text-muted-foreground">Tentukan hadiah di menu Target Ortu</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleEnterChildModeDirect}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 rounded-xl shadow-md flex-1 cursor-pointer flex items-center justify-center gap-1.5 text-xs"
            >
              <Play className="h-3.5 w-3.5 fill-white" />
              Mode Anak
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push(`/parent/goal/${child.id}`)}
              className="text-xs font-bold rounded-xl h-10 border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Detail Misi
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
