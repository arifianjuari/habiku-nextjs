"use client";

import { useTransition } from "react";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Flame,
  Sparkles,
  Calendar,
  CheckCircle,
  Star,
  Gift,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { checkInChildAction } from "@/app/child/actions";
import { ChildBroadcastSticky } from "@/components/child/child-broadcast-sticky";
import { ChildDailyTipStrip } from "@/components/child/child-daily-tip-strip";
import { ChildFamilySharedGoalCard } from "@/components/child/child-family-shared-goal-card";
import { ChildSiblingHighlight } from "@/components/child/child-sibling-highlight";
import { ChildAvatar } from "@/components/shared/child-avatar";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { ChildFetchingIndicator } from "@/components/shared/child-fetching-indicator";
import {
  useChildHomeData,
  usePatchChildHomeCache,
} from "@/lib/hooks/use-child-home-data";
import {
  buildChildHeroGradient,
  resolveHomeCardAccent,
} from "@/lib/child/resolve-home-card-accent";

const sectionMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function StreakFlames({ days }: { days: number }) {
  const capped = Math.min(days, 7);
  if (capped === 0) return null;

  return (
    <div className="flex items-center gap-0.5" aria-label={`${days} hari berturut-turut`}>
      {Array.from({ length: capped }).map((_, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: i * 0.05, type: "spring", stiffness: 400 }}
          className="text-base leading-none"
        >
          🔥
        </motion.span>
      ))}
      {days > 7 && (
        <span className="ml-1 text-xs font-black text-orange-700">+{days - 7}</span>
      )}
    </div>
  );
}

import type { ChildHomeData } from "@/lib/child/fetch-child-data";

type ChildHomeViewProps = {
  initialData?: ChildHomeData;
};

export function ChildHomeView({ initialData }: ChildHomeViewProps = {}) {
  const { profileId, profileName } = useChildModeStore();
  const { data, isLoading, isFetching } = useChildHomeData(profileId, initialData);
  const patchHome = usePatchChildHomeCache(profileId ?? "");
  const [isPending, startTransition] = useTransition();

  const handleCheckIn = () => {
    if (!profileId) return;

    startTransition(async () => {
      const res = await checkInChildAction(profileId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }

      if (res.already) {
        toast.info("Kamu sudah melakukan check-in hari ini!");
      } else {
        toast.success(`Check-in berhasil! Kamu mendapatkan +${res.bonus} Energi! 🎯`);
      }

      patchHome({
        isCheckedInToday: true,
        checkInChain:
          typeof res.chain_length === "number"
            ? res.chain_length
            : (data?.checkInChain ?? 0),
        totalPoints:
          (data?.totalPoints ?? 0) + (res.already ? 0 : (res.bonus || 2)),
      });
    });
  };

  if (!profileId || (isLoading && !data)) {
    return <PageLoadingSkeleton variant="child" className="min-h-[50vh]" />;
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <span className="text-4xl" aria-hidden>
          😅
        </span>
        <p className="text-sm font-bold text-emerald-800">Gagal memuat beranda.</p>
        <p className="text-xs text-emerald-600">Coba refresh halaman ya!</p>
      </div>
    );
  }

  const {
    child,
    activeGoal,
    totalPoints,
    checkInChain,
    isCheckedInToday,
    engagement,
    sharedFamilyGoal,
  } = data;
  const {
    personalStickyMessage,
    familyBroadcastMessage,
    dailyTip,
    siblingHighlight,
    settings,
  } = engagement;
  const heroSubtitle =
    familyBroadcastMessage ??
    "Kumpulkan energi, selesaikan misi, dan raih hadiah impianmu!";
  const childAccent = resolveHomeCardAccent(child?.home_card_accent, {
    gender: child?.gender,
    fallback: "#10B981",
  });
  const microAnim = settings.microAnimEnabled;
  const firstName = (profileName || "Petualang").split(" ")[0];

  const goalPercent = activeGoal
    ? Math.min(100, (activeGoal.current_hp / activeGoal.target_hp) * 100)
    : 0;

  return (
    <div className="relative space-y-3.5 pb-2" data-fetching={isFetching ? "" : undefined}>
      <ChildFetchingIndicator isFetching={isFetching && !!data} />
      {/* Hero petualang */}
      <motion.section
        {...sectionMotion}
        className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-emerald-600 via-teal-500 to-violet-600 p-5 text-white shadow-xl"
        style={{ backgroundImage: buildChildHeroGradient(childAccent) }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
          <div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-yellow-300/20 blur-2xl" />
          <Sparkles className="absolute right-4 top-3 h-16 w-16 text-white/25 fill-white/20 animate-pulse" />
          <Star className="absolute bottom-6 right-16 h-5 w-5 text-amber-200 fill-amber-200/80 animate-bounce" />
        </div>

        <div className="relative flex items-start gap-4">
          <motion.div
            animate={microAnim ? { y: [0, -4, 0] } : undefined}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          >
            <ChildAvatar
              name={profileName || "Anak"}
              avatarUrl={child?.avatar_url || null}
              avatarPreference={child?.avatar_preference}
              avatarEmoji={child?.avatar_emoji}
              accentColor={childAccent}
              className="h-16 w-16 shrink-0 rounded-[1.25rem] border-2 border-white/40 shadow-lg text-2xl font-bold text-white"
              fallbackSizeClass="text-3xl"
            />
          </motion.div>

          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
              Petualang Habiku
            </p>
            <h2 className="font-heading text-xl font-black leading-tight tracking-tight">
              Hai, {firstName}! 👋
            </h2>
            <p className="text-xs font-medium leading-relaxed text-white/90">
              {heroSubtitle}
            </p>
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/25 bg-black/15 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/90 shadow-inner">
              <Zap className="h-5 w-5 text-amber-950 fill-amber-200" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/75">
                Energi kamu
              </p>
              <p className="text-lg font-black leading-none">{totalPoints} E</p>
            </div>
          </div>
          {checkInChain > 0 && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold text-orange-100">Streak!</span>
              <div className="flex items-center gap-1 rounded-full bg-orange-500/30 px-2.5 py-1 border border-orange-300/30">
                <Flame className="h-4 w-4 text-orange-200 fill-orange-300" />
                <span className="text-sm font-black">{checkInChain} hari</span>
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {personalStickyMessage && profileId && (
        <ChildBroadcastSticky
          profileId={profileId}
          message={personalStickyMessage}
          microAnimEnabled={microAnim}
        />
      )}

      <ChildFamilySharedGoalCard
        sharedFamilyGoal={sharedFamilyGoal}
        microAnimEnabled={microAnim}
      />

      {/* Check-in harian */}
      <motion.div {...sectionMotion} transition={{ delay: 0.08 }}>
        <Card
          size="sm"
          className="gap-0 overflow-hidden rounded-[1.75rem] border-2 border-sky-100 bg-gradient-to-br from-sky-50/90 via-white to-cyan-50/50 py-0 shadow-md"
        >
          <CardContent className="space-y-3 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-md">
                  <Calendar className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-slate-900">Absen Harian</h3>
              </div>
              <StreakFlames days={checkInChain} />
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
                    className="h-11 w-full cursor-pointer rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-sm font-black text-white shadow-lg shadow-sky-500/25 hover:from-sky-600 hover:to-blue-700"
                  >
                    <Sparkles className="mr-2 h-5 w-5 fill-amber-200 text-amber-200" />
                    {isPending ? "Sedang Check-in..." : "Klaim Check-in! +2 E ⚡"}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="checkin-done"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800"
                >
                  <CheckCircle className="h-6 w-6 shrink-0 text-emerald-600" />
                  <span>Sudah check-in hari ini! Keren! 🎉</span>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quest hadiah */}
      {activeGoal ? (
        <motion.div {...sectionMotion} transition={{ delay: 0.12 }}>
          <Card
            size="sm"
            className="gap-0 overflow-hidden rounded-[1.75rem] border-2 border-rose-100 bg-gradient-to-br from-rose-50/80 via-white to-pink-50/50 py-0 shadow-md"
          >
            <CardContent className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-black text-slate-900">Quest Hadiah</h3>
                    <p className="text-xs font-medium text-slate-500">
                      Isi HP penuh untuk klaim hadiah!
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-700">
                  {Math.round(goalPercent)}%
                </span>
              </div>

              <div className="space-y-2.5 rounded-xl border border-rose-100/80 bg-white/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-black text-slate-800">
                    <span className="text-lg" aria-hidden>
                      🎁
                    </span>
                    {activeGoal.title}
                  </span>
                  <span className="shrink-0 text-sm font-black text-rose-600">
                    {activeGoal.current_hp}/{activeGoal.target_hp} HP
                  </span>
                </div>

                <div className="relative h-5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
                  <motion.div
                    className="relative h-full rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${goalPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.35)_50%,transparent_100%)] animate-pulse" />
                  </motion.div>
                  {goalPercent > 8 && (
                    <motion.span
                      className="absolute top-1/2 -translate-y-1/2 text-xs"
                      style={{ left: `calc(${goalPercent}% - 12px)` }}
                      animate={microAnim ? { scale: [1, 1.2, 1] } : undefined}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      aria-hidden
                    >
                      ⭐
                    </motion.span>
                  )}
                </div>

                <p className="text-center text-xs font-bold text-slate-600">
                  {activeGoal.current_hp >= activeGoal.target_hp
                    ? "Wah! Hadiah siap diklaim ke Papa/Mama! 🎊"
                    : `Tinggal ${activeGoal.target_hp - activeGoal.current_hp} HP lagi — semangat! 💪`}
                </p>
              </div>

              <Link
                href="/child/targets"
                className="flex h-9 items-center justify-center gap-1 rounded-xl bg-rose-600 text-xs font-black text-white shadow-md transition-colors hover:bg-rose-700"
              >
                Lihat Targetku
                <ChevronRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div {...sectionMotion} transition={{ delay: 0.12 }}>
          <div className="flex flex-col items-center justify-center space-y-3 rounded-[1.75rem] border-2 border-dashed border-violet-200 bg-white/60 p-8 text-center backdrop-blur-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-3xl shadow-inner">
              🏆
            </div>
            <h3 className="text-sm font-black text-slate-800">Belum Ada Quest Hadiah</h3>
            <p className="max-w-[240px] text-xs font-medium leading-relaxed text-slate-500">
              Minta Papa atau Mama mengaktifkan target hadiah pertamamu — lalu mulai
              petualangan!
            </p>
            <Link
              href="/child/missions"
              className="inline-flex h-10 items-center gap-1 rounded-xl bg-violet-600 px-4 text-xs font-black text-white shadow-md hover:bg-violet-700"
            >
              Mulai Misi
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      )}

      {settings.dailyTipEnabled && dailyTip && (
        <ChildDailyTipStrip tip={dailyTip} microAnimEnabled={microAnim} />
      )}

      {settings.showSiblingHighlight && siblingHighlight && (
        <ChildSiblingHighlight
          highlight={siblingHighlight}
          microAnimEnabled={microAnim}
        />
      )}

      {/* CTA misi */}
      <motion.div {...sectionMotion} transition={{ delay: 0.16 }}>
        <Link
          href="/child/missions"
          className="group flex items-center gap-3 rounded-[1.75rem] border-2 border-emerald-200 bg-gradient-to-r from-emerald-500 to-teal-500 p-3 text-white shadow-lg transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-inner">
            🚀
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">Siap berpetualang?</p>
            <p className="text-xs font-medium text-emerald-50">
              Kerjakan misi hari ini dan kumpulkan energi!
            </p>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    </div>
  );
}
