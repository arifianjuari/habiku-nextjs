import {
  energyPerGramFromUsd,
  marketEnergyPrices,
  TROY_OUNCE_GRAMS,
  type MarketEnergyPrices,
} from "@/lib/gold/market-price";

const GOLD_QUOTE_URL = "https://api.gold-api.com/price/XAU";
const FX_QUOTE_URL = "https://open.er-api.com/v6/latest/USD";

export type MarketGoldQuote = MarketEnergyPrices & {
  usdPerOunce: number;
  idrPerUsd: number;
  idrPerGram: number;
  spotEnergy: number;
  quotedAt: string;
};

type GoldApiPayload = {
  price?: unknown;
  updatedAt?: unknown;
};

type FxApiPayload = {
  result?: unknown;
  rates?: { IDR?: unknown };
  time_last_update_utc?: unknown;
};

function readPositiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Harga emas dunia (USD/troy oz) + kurs USD/IDR, diubah ke energi per gram.
 * Gagal total jika salah satu sumber tidak menjawab — harga tersimpan tidak diubah.
 */
export async function fetchMarketGoldQuote(timeoutMs = 8000): Promise<MarketGoldQuote> {
  const signal = AbortSignal.timeout(timeoutMs);
  const [goldRes, fxRes] = await Promise.all([
    fetch(GOLD_QUOTE_URL, { signal, cache: "no-store" }),
    fetch(FX_QUOTE_URL, { signal, cache: "no-store" }),
  ]);

  if (!goldRes.ok || !fxRes.ok) {
    throw new Error("market_quote_unavailable");
  }

  const [goldJson, fxJson] = (await Promise.all([goldRes.json(), fxRes.json()])) as [
    GoldApiPayload,
    FxApiPayload,
  ];

  const usdPerOunce = readPositiveNumber(goldJson.price);
  const idrPerUsd = readPositiveNumber(fxJson.rates?.IDR);
  if (usdPerOunce == null || idrPerUsd == null || fxJson.result === "error") {
    throw new Error("market_quote_invalid");
  }

  const idrPerGram = Math.round((usdPerOunce / TROY_OUNCE_GRAMS) * idrPerUsd);
  const spotEnergy = energyPerGramFromUsd(usdPerOunce, idrPerUsd);
  const prices = marketEnergyPrices(spotEnergy);
  const quotedAt =
    (typeof goldJson.updatedAt === "string" && goldJson.updatedAt) ||
    (typeof fxJson.time_last_update_utc === "string" && fxJson.time_last_update_utc) ||
    new Date().toISOString();

  return {
    usdPerOunce,
    idrPerUsd,
    idrPerGram,
    spotEnergy,
    quotedAt,
    ...prices,
  };
}
