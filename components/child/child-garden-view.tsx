"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sprout, Trophy, Lock } from "lucide-react";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { fetchChildGardenGoals, type GardenGoal } from "@/lib/child/fetch-child-garden";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function ChildGardenView() {
  const { profileId, profileName } = useChildModeStore();
  const [goals, setGoals] = useState<GardenGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;
    const activeProfileId = profileId;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchChildGardenGoals(activeProfileId);
        if (!cancelled) setGoals(data);
      } catch (err) {
        console.error("Garden load error:", err);
        if (!cancelled) setGoals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (!profileId || loading) {
    return <PageLoadingSkeleton variant="child" className="min-h-[50vh]" />;
  }

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-lime-600 to-emerald-800 p-5 text-white shadow-lg"
      >
        <Sprout className="absolute right-3 top-3 h-16 w-16 text-white/20" aria-hidden />
        <h2 className="font-heading text-lg font-black">Kebun Energi {profileName}</h2>
        <p className="mt-1 text-[11px] text-lime-50/90 max-w-[260px]">
          Setiap target yang kamu capai menanam satu &quot;pohon hadiah&quot; di kebun ini.
        </p>
        <p className="mt-3 text-sm font-extrabold">
          {goals.length} hadiah tercapai 🌱
        </p>
      </motion.section>

      {goals.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-emerald-200 bg-white/60">
          <CardContent className="p-8 text-center space-y-2">
            <Lock className="h-8 w-8 mx-auto text-emerald-400" aria-hidden />
            <p className="text-xs font-bold text-slate-700">Kebun masih kosong</p>
            <p className="text-[10px] text-slate-500 max-w-xs mx-auto">
              Selesaikan misi dan kumpulkan HP target — hadiah pertamamu akan muncul di sini!
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {goals.map((goal, index) => (
            <motion.li
              key={goal.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card className="rounded-2xl border-emerald-100 bg-white/80 overflow-hidden h-full">
                {goal.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={goal.image_url}
                    alt=""
                    className="h-28 w-full object-cover"
                  />
                ) : (
                  <div className="h-28 w-full bg-gradient-to-br from-emerald-100 to-lime-100 flex items-center justify-center">
                    <Trophy className="h-10 w-10 text-emerald-600/60" aria-hidden />
                  </div>
                )}
                <CardContent className="p-3 space-y-1">
                  <h3 className="text-xs font-black text-slate-900 leading-tight">{goal.title}</h3>
                  <p className="text-[10px] text-emerald-700 font-semibold">
                    {goal.target_hp} HP · Hadiah diraih 🎉
                  </p>
                </CardContent>
              </Card>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
