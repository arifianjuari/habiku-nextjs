"use client";

import { useId, useMemo } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import {
  buildGoldPnlChartPaths,
  formatPnlPercent,
  type GoldPnlSnapshot,
} from "@/lib/gold/pnl";
import { useChildGoldPnl } from "@/lib/hooks/use-child-gold-pnl";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ChildGoldPnlPanelProps = {
  profileId: string;
  quantityMilli: number;
  buyPriceEnergy: number;
  sellPriceEnergy: number;
  unitLabel: string;
  hasHoldings: boolean;
  enabled: boolean;
};

const CHART_WIDTH = 280;
const CHART_HEIGHT = 72;

function PnlPanelSkeleton() {
  return (
    <Card className="border-dashed border-amber-200/80 bg-amber-50/30 shadow-sm">
      <CardContent className="space-y-2 p-4">
        <div className="h-3 w-32 animate-pulse rounded bg-amber-100" />
        <div className="h-16 animate-pulse rounded-xl bg-amber-100/60" />
      </CardContent>
    </Card>
  );
}

function PnlPanelContent({
  pnl,
  unitLabel,
  hasHoldings,
}: {
  pnl: GoldPnlSnapshot;
  unitLabel: string;
  hasHoldings: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const chart = useMemo(
    () => buildGoldPnlChartPaths(pnl.history, CHART_WIDTH, CHART_HEIGHT),
    [pnl.history],
  );

  const isProfit = pnl.unrealizedPnlEnergy > 0;
  const isFlat = pnl.unrealizedPnlEnergy === 0;
  const hasCostBasis = pnl.costBasisEnergy > 0 && hasHoldings;

  const trendIcon = isFlat ? (
    <Minus className="size-4" aria-hidden />
  ) : isProfit ? (
    <TrendingUp className="size-4" aria-hidden />
  ) : (
    <TrendingDown className="size-4" aria-hidden />
  );

  const pnlLabel = isFlat
    ? "Impas"
    : isProfit
      ? `Untung ${pnl.unrealizedPnlEnergy} E`
      : `Rugi ${Math.abs(pnl.unrealizedPnlEnergy)} E`;

  const ariaSummary = hasCostBasis
    ? `${pnlLabel}, ${formatPnlPercent(pnl.unrealizedPnlPercent)} dari modal ${pnl.costBasisEnergy} energi. Nilai jual sekarang ${pnl.marketValueEnergy} energi.`
    : "Belum ada modal emas untuk dihitung untung rugi.";

  if (!hasHoldings && pnl.history.length === 0) {
    return (
      <Card className="border-dashed border-amber-200/80 bg-amber-50/30 shadow-sm">
        <CardContent className="space-y-2 p-4 text-center">
          <p className="text-xs font-bold text-amber-950">Grafik untung/rugi</p>
          <p className="text-[11px] text-muted-foreground text-pretty">
            Setelah emasmu disetujui ortu, grafik perkembangan nilai emas akan muncul di sini.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-amber-200/70 bg-gradient-to-br from-white via-amber-50/40 to-orange-50/30 shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-bold text-amber-950">Perkembangan emasku</p>
            <p className="text-[10px] text-muted-foreground text-pretty">
              Nilai jual ortu sekarang vs modal belimu
            </p>
          </div>
          <div
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums",
              isFlat
                ? "bg-slate-100 text-slate-700"
                : isProfit
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-rose-100 text-rose-800",
            )}
            aria-label={ariaSummary}
          >
            {trendIcon}
            <span>{pnlLabel}</span>
            {hasCostBasis && pnl.unrealizedPnlPercent !== null ? (
              <span className="opacity-80">({formatPnlPercent(pnl.unrealizedPnlPercent)})</span>
            ) : null}
          </div>
        </div>

        {chart && pnl.history.length > 1 ? (
          <div
            className="relative overflow-hidden rounded-xl border border-amber-100/80 bg-white/70 px-1 py-2"
            role="img"
            aria-label={ariaSummary}
          >
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="h-[4.5rem] w-full"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isProfit ? "rgb(16 185 129)" : "rgb(244 63 94)"}
                    stopOpacity="0.35"
                  />
                  <stop
                    offset="100%"
                    stopColor={isProfit ? "rgb(16 185 129)" : "rgb(244 63 94)"}
                    stopOpacity="0.03"
                  />
                </linearGradient>
              </defs>
              <path d={chart.valueArea} fill={`url(#${gradientId})`} />
              <path
                d={chart.costLine}
                fill="none"
                stroke="rgb(217 119 6)"
                strokeWidth="2"
                strokeDasharray="4 3"
                strokeLinecap="round"
              />
              <path
                d={chart.valueLine}
                fill="none"
                stroke={isProfit ? "rgb(5 150 105)" : "rgb(225 29 72)"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 pt-1 text-[9px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-amber-600" />
                Modal
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className={cn(
                    "inline-block h-0.5 w-3 rounded-full",
                    isProfit ? "bg-emerald-600" : "bg-rose-600",
                  )}
                />
                Nilai jual sekarang
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-amber-100 bg-white/80 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Modal</p>
              <p className="font-heading text-lg font-black tabular-nums text-amber-800">
                {pnl.costBasisEnergy}
                <span className="ml-1 text-xs font-bold text-muted-foreground">E</span>
              </p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white/80 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Nilai jual</p>
              <p className="font-heading text-lg font-black tabular-nums text-emerald-700">
                {pnl.marketValueEnergy}
                <span className="ml-1 text-xs font-bold text-muted-foreground">E</span>
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-lg bg-white/60 px-2.5 py-2">
            <p className="text-muted-foreground">Harga beli ortu</p>
            <p className="mt-0.5 font-bold tabular-nums text-foreground">
              {pnl.currentBuyPriceEnergy} E / {unitLabel}
            </p>
            {pnl.avgBuyPricePerUnit !== null ? (
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                Modal rata-rata: {pnl.avgBuyPricePerUnit} E / {unitLabel}
              </p>
            ) : null}
          </div>
          <div className="rounded-lg bg-white/60 px-2.5 py-2">
            <p className="text-muted-foreground">Harga jual ortu</p>
            <p className="mt-0.5 font-bold tabular-nums text-foreground">
              {pnl.currentSellPriceEnergy} E / {unitLabel}
            </p>
            {pnl.priceVsAvgPercent !== null ? (
              <p
                className={cn(
                  "mt-0.5 text-[9px] font-semibold",
                  pnl.priceVsAvgPercent >= 0 ? "text-emerald-700" : "text-rose-700",
                )}
              >
                {pnl.priceVsAvgPercent >= 0 ? "Naik" : "Turun"}{" "}
                {formatPnlPercent(Math.abs(pnl.priceVsAvgPercent))} vs modal
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChildGoldPnlPanel({
  profileId,
  quantityMilli,
  buyPriceEnergy,
  sellPriceEnergy,
  unitLabel,
  hasHoldings,
  enabled,
}: ChildGoldPnlPanelProps) {
  const { data: pnl, isLoading } = useChildGoldPnl(
    profileId,
    quantityMilli,
    buyPriceEnergy,
    sellPriceEnergy,
    enabled,
  );

  if (isLoading || !pnl) {
    return <PnlPanelSkeleton />;
  }

  return (
    <PnlPanelContent pnl={pnl} unitLabel={unitLabel} hasHoldings={hasHoldings} />
  );
}
