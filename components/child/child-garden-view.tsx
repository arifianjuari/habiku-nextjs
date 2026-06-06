"use client";

import { Sprout, Trophy, Lock } from "lucide-react";
import { useChildModeStore } from "@/lib/stores/child-mode-store";
import { useChildGardenData } from "@/lib/hooks/use-child-garden-data";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";
import { ChildFetchingIndicator } from "@/components/shared/child-fetching-indicator";
import { SupabaseImage } from "@/components/shared/supabase-image";
import { Card, CardContent } from "@/components/ui/card";

export function ChildGardenView() {
  const { profileId, profileName } = useChildModeStore();
  const { data: goals = [], isLoading, isFetching } = useChildGardenData(profileId);

  if (!profileId || (isLoading && goals.length === 0)) {
    return <PageLoadingSkeleton variant="child" className="min-h-[50vh]" />;
  }

  return (
    <div className="relative space-y-6" data-fetching={isFetching ? "" : undefined}>
      <ChildFetchingIndicator isFetching={isFetching && goals.length > 0} />

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-lime-600 to-emerald-800 p-5 text-white shadow-lg">
        <Sprout className="absolute right-3 top-3 h-16 w-16 text-white/20" aria-hidden />
        <h2 className="font-heading text-lg font-black">Kebun Energi {profileName}</h2>
        <p className="mt-1 max-w-[260px] text-[11px] text-lime-50/90">
          Setiap target yang kamu capai menanam satu &quot;pohon hadiah&quot; di kebun ini.
        </p>
        <p className="mt-3 text-sm font-extrabold">
          {goals.length} hadiah tercapai 🌱
        </p>
      </section>

      {goals.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-emerald-200 bg-white/60">
          <CardContent className="space-y-2 p-8 text-center">
            <Lock className="mx-auto h-8 w-8 text-emerald-400" aria-hidden />
            <p className="text-xs font-bold text-slate-700">Kebun masih kosong</p>
            <p className="mx-auto max-w-xs text-[10px] text-slate-500">
              Selesaikan misi dan kumpulkan HP target — hadiah pertamamu akan muncul di sini!
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {goals.map((goal) => (
            <li key={goal.id}>
              <Card className="h-full overflow-hidden rounded-2xl border-emerald-100 bg-white/80">
                {goal.image_url ? (
                  <div className="relative h-28 w-full">
                    <SupabaseImage
                      src={goal.image_url}
                      alt={goal.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 512px) 50vw, 240px"
                    />
                  </div>
                ) : (
                  <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-emerald-100 to-lime-100">
                    <Trophy className="h-10 w-10 text-emerald-600/60" aria-hidden />
                  </div>
                )}
                <CardContent className="space-y-1 p-3">
                  <h3 className="text-xs font-black leading-tight text-slate-900">{goal.title}</h3>
                  <p className="text-[10px] font-semibold text-emerald-700">
                    {goal.target_hp} HP · Hadiah diraih 🎉
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
