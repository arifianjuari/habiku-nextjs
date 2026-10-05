/** 1 troy ounce dalam gram. Acuan harga XAU dunia memakai satuan ini. */
export const TROY_OUNCE_GRAMS = 31.1034768;

/**
 * Selisih toko terhadap acuan spot.
 * Harga jual (anak beli) = spot + delta, harga beli (anak jual) = spot − delta.
 */
export const MARKET_SPREAD_RATIO = 0.02;

export type MarketEnergyPrices = {
  sellPriceEnergy: number;
  buyPriceEnergy: number;
};

/**
 * Energi per 1 gram = rupiah per gram, tiga nol terakhir dibuang (floor / 1000).
 * 1 butir di Habiku diperlakukan sebagai 1 gram.
 */
export function energyPerGramFromUsd(usdPerOunce: number, idrPerUsd: number): number {
  if (!(usdPerOunce > 0) || !(idrPerUsd > 0) || !Number.isFinite(usdPerOunce) || !Number.isFinite(idrPerUsd)) {
    return 0;
  }
  const idrPerGram = (usdPerOunce / TROY_OUNCE_GRAMS) * idrPerUsd;
  return Math.floor(idrPerGram / 1000);
}

/** Harga toko dari acuan spot, dengan jaminan harga beli anak lebih rendah dari harga jual. */
export function marketEnergyPrices(spotEnergy: number): MarketEnergyPrices {
  const spot = Math.floor(spotEnergy);
  if (!(spot >= 1)) {
    return { sellPriceEnergy: 2, buyPriceEnergy: 1 };
  }

  const delta = Math.max(1, Math.round(spot * MARKET_SPREAD_RATIO));
  const sellPriceEnergy = spot + delta;
  let buyPriceEnergy = spot - delta;
  if (buyPriceEnergy < 1) buyPriceEnergy = 1;
  if (buyPriceEnergy >= sellPriceEnergy) buyPriceEnergy = sellPriceEnergy - 1;

  return { sellPriceEnergy, buyPriceEnergy };
}
