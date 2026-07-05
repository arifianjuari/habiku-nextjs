import { energyForSellMilli, GOLD_MILLI_PER_UNIT } from "@/lib/gold/units";
import type { GoldTransactionRow } from "@/lib/gold/types";

export type GoldPnlPoint = {
  at: string;
  costBasisEnergy: number;
  marketValueEnergy: number;
  holdingsMilli: number;
};

export type GoldPnlSnapshot = {
  costBasisEnergy: number;
  marketValueEnergy: number;
  unrealizedPnlEnergy: number;
  unrealizedPnlPercent: number | null;
  avgBuyPricePerUnit: number | null;
  currentBuyPriceEnergy: number;
  currentSellPriceEnergy: number;
  priceVsAvgPercent: number | null;
  history: GoldPnlPoint[];
};

function applyApprovedTx(
  holdings: number,
  costBasis: number,
  tx: GoldTransactionRow,
): { holdings: number; costBasis: number } {
  if (tx.kind === "buy") {
    return {
      holdings: holdings + tx.quantityMilli,
      costBasis: costBasis + tx.energy_amount,
    };
  }

  if (holdings <= 0 || tx.quantityMilli <= 0) {
    return {
      holdings: Math.max(0, holdings - tx.quantityMilli),
      costBasis: 0,
    };
  }

  const sold = Math.min(tx.quantityMilli, holdings);
  const ratio = sold / holdings;
  return {
    holdings: holdings - sold,
    costBasis: Math.round(costBasis * (1 - ratio)),
  };
}

export function computeGoldPnlSnapshot(
  transactions: GoldTransactionRow[],
  holdingsMilli: number,
  currentBuyPriceEnergy: number,
  currentSellPriceEnergy: number,
): GoldPnlSnapshot {
  const approved = [...transactions]
    .filter((t) => t.status === "approved")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  let holdings = 0;
  let costBasis = 0;
  const history: GoldPnlPoint[] = [];

  for (const tx of approved) {
    ({ holdings, costBasis } = applyApprovedTx(holdings, costBasis, tx));
    history.push({
      at: tx.created_at,
      holdingsMilli: holdings,
      costBasisEnergy: costBasis,
      marketValueEnergy: energyForSellMilli(holdings, currentBuyPriceEnergy),
    });
  }

  if (holdings !== holdingsMilli && holdings > 0 && holdingsMilli >= 0) {
    costBasis = Math.round((costBasis * holdingsMilli) / holdings);
  }

  const marketValueEnergy = energyForSellMilli(holdingsMilli, currentBuyPriceEnergy);
  const unrealizedPnlEnergy = marketValueEnergy - costBasis;
  const unrealizedPnlPercent =
    costBasis > 0 ? (unrealizedPnlEnergy / costBasis) * 100 : null;

  const avgBuyPricePerUnit =
    holdingsMilli > 0
      ? Math.round((costBasis * GOLD_MILLI_PER_UNIT) / holdingsMilli)
      : null;

  const priceVsAvgPercent =
    avgBuyPricePerUnit && avgBuyPricePerUnit > 0
      ? ((currentBuyPriceEnergy - avgBuyPricePerUnit) / avgBuyPricePerUnit) * 100
      : null;

  const last = history[history.length - 1];
  if (
    holdingsMilli > 0 &&
    (!last ||
      last.marketValueEnergy !== marketValueEnergy ||
      last.costBasisEnergy !== costBasis ||
      last.holdingsMilli !== holdingsMilli)
  ) {
    history.push({
      at: new Date().toISOString(),
      costBasisEnergy: costBasis,
      marketValueEnergy,
      holdingsMilli,
    });
  }

  return {
    costBasisEnergy: costBasis,
    marketValueEnergy,
    unrealizedPnlEnergy,
    unrealizedPnlPercent,
    avgBuyPricePerUnit,
    currentBuyPriceEnergy,
    currentSellPriceEnergy,
    priceVsAvgPercent,
    history,
  };
}

export type GoldChartPaths = {
  costLine: string;
  valueArea: string;
  valueLine: string;
  dots: { x: number; y: number; kind: "cost" | "value" }[];
};

export function buildGoldPnlChartPaths(
  points: GoldPnlPoint[],
  width: number,
  height: number,
): GoldChartPaths | null {
  if (points.length === 0) return null;

  const padY = 6;
  const innerH = height - padY * 2;
  const values = points.flatMap((p) => [p.costBasisEnergy, p.marketValueEnergy]);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, min + 1);
  const range = max - min;

  const toY = (value: number) =>
    padY + innerH - ((value - min) / range) * innerH;

  const xForIndex = (index: number) => {
    if (points.length === 1) return width / 2;
    return (index / (points.length - 1)) * width;
  };

  const costCoords = points.map((p, i) => ({ x: xForIndex(i), y: toY(p.costBasisEnergy) }));
  const valueCoords = points.map((p, i) => ({
    x: xForIndex(i),
    y: toY(p.marketValueEnergy),
  }));

  const costLine = costCoords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");

  const valueLine = valueCoords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");

  const first = valueCoords[0];
  const last = valueCoords[valueCoords.length - 1];
  const valueArea = [
    `M ${first.x.toFixed(2)} ${(height - padY).toFixed(2)}`,
    `L ${first.x.toFixed(2)} ${first.y.toFixed(2)}`,
    ...valueCoords.slice(1).map((c) => `L ${c.x.toFixed(2)} ${c.y.toFixed(2)}`),
    `L ${last.x.toFixed(2)} ${(height - padY).toFixed(2)}`,
    "Z",
  ].join(" ");

  const dots = [
    ...costCoords.map((c) => ({ ...c, kind: "cost" as const })),
    ...valueCoords.map((c) => ({ ...c, kind: "value" as const })),
  ];

  return { costLine, valueArea, valueLine, dots };
}

export function formatPnlPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}
