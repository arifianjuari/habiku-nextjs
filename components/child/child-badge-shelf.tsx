"use client";

import { useState } from "react";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { useChildBadgesData } from "@/lib/hooks/use-child-badges-data";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { ChildFetchingIndicator } from "@/components/shared/child-fetching-indicator";
import { AnimatePresence, m } from "@/lib/motion";
import { ChildMotionRoot } from "@/components/child/child-motion-root";
import {
  Award,
  Lock,
  Sparkles,
  Zap,
  Flame,
  Trophy,
  Compass,
  Calendar,
  ShieldAlert,
  Star,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface BadgeMetadata {
  key: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  bgGlow: string;
}

const ALL_BADGES: BadgeMetadata[] = [
  {
    key: "first_steps",
    title: "Langkah Pertama 👣",
    desc: "Menyelesaikan misi pertamamu untuk memulai petualangan besar!",
    icon: <Compass className="h-6 w-6" />,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    borderColor: "border-blue-300",
    bgGlow: "from-blue-500/20 to-cyan-500/20",
  },
  {
    key: "mission_5",
    title: "Petualang Muda 🎒",
    desc: "Menuntaskan 5 misi. Kamu mulai terbiasa membangun rutinitas baik!",
    icon: <Award className="h-6 w-6" />,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    borderColor: "border-indigo-300",
    bgGlow: "from-indigo-500/20 to-purple-500/20",
  },
  {
    key: "mission_25",
    title: "Veteran Tangguh 🛡️",
    desc: "Menuntaskan 25 misi! Kedisiplinanmu setara ksatria pelindung kerajaan.",
    icon: <Trophy className="h-6 w-6" />,
    color: "text-violet-600 bg-violet-50 border-violet-200",
    borderColor: "border-violet-300",
    bgGlow: "from-violet-500/20 to-fuchsia-500/20",
  },
  {
    key: "streak_3_any",
    title: "Pelari Cepat ⚡",
    desc: "Menjaga streak harian misi selama 3 hari berturut-turut!",
    icon: <Zap className="h-6 w-6" />,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    borderColor: "border-amber-300",
    bgGlow: "from-amber-500/20 to-orange-500/20",
  },
  {
    key: "streak_7_any",
    title: "Pengendali Api 🔥",
    desc: "Luar biasa! Mempertahankan streak 7 hari. Semangat belajarmu membara!",
    icon: <Flame className="h-6 w-6" />,
    color: "text-orange-600 bg-orange-50 border-orange-200",
    borderColor: "border-orange-300",
    bgGlow: "from-orange-500/20 to-rose-500/20",
  },
  {
    key: "goal_first",
    title: "Harta Pertama 🗝️",
    desc: "Menebus target hadiah pertamamu. Petualangan berbuah manis!",
    icon: <Trophy className="h-6 w-6" />,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    borderColor: "border-emerald-300",
    bgGlow: "from-emerald-500/20 to-teal-500/20",
  },
  {
    key: "goal_3",
    title: "Raja Penimbun 👑",
    desc: "Menebus 3 target hadiah. Kamar petualangmu dipenuhi harta karun!",
    icon: <Award className="h-6 w-6" />,
    color: "text-rose-600 bg-rose-50 border-rose-200",
    borderColor: "border-rose-300",
    bgGlow: "from-rose-500/20 to-pink-500/20",
  },
  {
    key: "check_in_7",
    title: "Kawan Setia 🤝",
    desc: "Konsisten check-in harian selama 7 hari berturut-turut.",
    icon: <Calendar className="h-6 w-6" />,
    color: "text-teal-600 bg-teal-50 border-teal-200",
    borderColor: "border-teal-300",
    bgGlow: "from-teal-500/20 to-emerald-500/20",
  },
  {
    key: "bonus_featured",
    title: "Pemburu Bintang 🌟",
    desc: "Menyelesaikan misi sorotan harian dengan multiplier energi ekstra!",
    icon: <Star className="h-6 w-6 animate-pulse" />,
    color: "text-yellow-600 bg-yellow-50 border-yellow-200",
    borderColor: "border-yellow-300",
    bgGlow: "from-yellow-500/20 to-amber-500/20",
  },
];

export function ChildBadgeShelf() {
  const { profileId, profileName } = useChildModeStore();
  const { data: unlockedKeys = [], isLoading, isFetching } = useChildBadgesData(profileId);
  const [selectedBadge, setSelectedBadge] = useState<BadgeMetadata | null>(ALL_BADGES[0]);

  if (!profileId || (isLoading && unlockedKeys.length === 0)) {
    return <PageLoadingSkeleton variant="child" className="min-h-[50vh]" />;
  }

  const unlockedCount = unlockedKeys.length;
  const totalCount = ALL_BADGES.length;

  return (
    <ChildMotionRoot>
    <div className="relative space-y-6" data-fetching={isFetching ? "" : undefined}>
      <ChildFetchingIndicator isFetching={isFetching && unlockedKeys.length > 0} />
      {/* 1. Welcoming & Counter Header */}
      <m.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-5 text-white bg-gradient-to-r from-violet-600 to-indigo-700 shadow-lg shadow-violet-950/20"
      >
        <div className="absolute top-2 right-4 opacity-25">
          <Award className="h-24 w-24 text-white fill-white animate-pulse" />
        </div>

        <div className="space-y-1">
          <h2 className="font-heading text-lg font-black tracking-tight leading-none">
            Lemari Lencanamu 🏆
          </h2>
          <p className="text-[10px] text-violet-50 leading-relaxed font-semibold">
            Tunjukkan prestasimu! Dapatkan lebih banyak lencana dengan menyelesaikan misi.
          </p>
        </div>

        {/* Counter Progress */}
        <div className="mt-4 flex items-center justify-between bg-violet-950/20 rounded-2xl p-2 px-3 border border-violet-500/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-100 flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
            Lencana Terbuka:
          </span>
          <span className="text-sm font-extrabold text-white">
            {unlockedCount} / {totalCount}
          </span>
        </div>
      </m.div>

      {/* 2. Badge Details Panel (Hovered/Clicked) */}
      {selectedBadge && (
        <m.div
          key={selectedBadge.key}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border border-violet-100 bg-white/70 backdrop-blur-md rounded-3xl shadow-sm overflow-hidden">
            <CardContent className="p-4 flex gap-3.5 items-start">
              {/* Badge Icon Grid */}
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xl font-black shadow-inner relative overflow-hidden ${
                unlockedKeys.includes(selectedBadge.key)
                  ? selectedBadge.color
                  : "bg-slate-100 text-slate-400 border-slate-200"
              }`}>
                {/* Glow behind if unlocked */}
                {unlockedKeys.includes(selectedBadge.key) && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${selectedBadge.bgGlow} opacity-30`} />
                )}
                {unlockedKeys.includes(selectedBadge.key) ? (
                  selectedBadge.icon
                ) : (
                  <Lock className="h-5 w-5 shrink-0" />
                )}
              </div>

              {/* Title & Desc */}
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-heading font-black text-sm text-slate-900 leading-none">
                    {selectedBadge.title}
                  </h4>
                  {unlockedKeys.includes(selectedBadge.key) && (
                    <div className="bg-emerald-50 border border-emerald-250 text-emerald-700 text-[8px] font-bold py-0.5 px-2 leading-none h-4 rounded-full flex items-center gap-0.5">
                      <Check className="h-2 w-2" />
                      TERBUKA
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-650 leading-relaxed font-medium">
                  {selectedBadge.desc}
                </p>
                {!unlockedKeys.includes(selectedBadge.key) && (
                  <span className="text-[9px] text-violet-750 font-bold block">
                    🔒 Kunci lencana ini dengan menyelesaikan persyaratan di atas!
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </m.div>
      )}

      {/* 3. Badges Grid */}
      <div className="grid grid-cols-3 gap-3">
        {ALL_BADGES.map((badge) => {
          const isUnlocked = unlockedKeys.includes(badge.key);
          const isSelected = selectedBadge?.key === badge.key;

          return (
            <m.button
              key={badge.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedBadge(badge)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer aspect-square ${
                isSelected
                  ? "bg-white shadow-md border-violet-300"
                  : isUnlocked
                  ? "bg-white/80 hover:bg-white border-slate-200 hover:shadow-sm"
                  : "bg-slate-100/50 border-slate-200/55 grayscale opacity-75"
              }`}
            >
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center mb-1.5 shrink-0 ${
                isUnlocked
                  ? badge.color
                  : "bg-slate-200/80 text-slate-400"
              }`}>
                {isUnlocked ? badge.icon : <Lock className="h-4.5 w-4.5" />}
              </div>
              <span className="text-[9px] font-extrabold text-slate-800 text-center leading-tight truncate w-full">
                {badge.title.split(" ")[0]} {/* only show word, or simple truncate */}
              </span>
            </m.button>
          );
        })}
      </div>
    </div>
    </ChildMotionRoot>
  );
}
