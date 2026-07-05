/** 1000 milli = 1 coin/butir emas (presisi 0,001). */
export const GOLD_MILLI_PER_UNIT = 1000;

export function milliToDisplayQuantity(milli: number): number {
  return milli / GOLD_MILLI_PER_UNIT;
}

export function parseQuantityInputToMilli(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  const milli = Math.round(value * GOLD_MILLI_PER_UNIT);
  if (milli < 1) return null;
  return milli;
}

export function formatGoldQuantity(
  milli: number,
  unitLabel = "butir",
  options?: { maxDecimals?: number },
): string {
  const maxDecimals = options?.maxDecimals ?? 3;
  const value = milli / GOLD_MILLI_PER_UNIT;
  const formatted = value.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
  return `${formatted} ${unitLabel}`;
}

export function energyForBuyMilli(quantityMilli: number, sellPriceEnergy: number): number {
  return Math.floor((quantityMilli * sellPriceEnergy) / GOLD_MILLI_PER_UNIT);
}

export function energyForSellMilli(quantityMilli: number, buyPriceEnergy: number): number {
  return Math.floor((quantityMilli * buyPriceEnergy) / GOLD_MILLI_PER_UNIT);
}

export function milliFromBuyEnergy(energyAmount: number, sellPriceEnergy: number): number {
  if (sellPriceEnergy <= 0 || energyAmount < 1) return 0;
  return Math.floor((energyAmount * GOLD_MILLI_PER_UNIT) / sellPriceEnergy);
}

export function maxBuyMilliFromEnergy(availableEnergy: number, sellPriceEnergy: number): number {
  return milliFromBuyEnergy(availableEnergy, sellPriceEnergy);
}
